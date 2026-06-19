import json
import os
import logging
import time
import base64
from pydantic import BaseModel
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# --- Funções de Criptografia Simétrica (Fernet) ---

def get_encryption_key():
    # Tenta obter a chave do ambiente
    key_env = os.getenv("CONFIG_ENCRYPTION_KEY")
    if key_env:
        try:
            # Verifica se já está no formato Fernet correto
            Fernet(key_env.encode())
            return key_env.encode()
        except Exception:
            pass
    # Caso não exista, deriva uma chave baseada em um segredo estático
    salt = b"agendasalas_salt_123"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(b"default_agendasalas_secret_key"))
    return key

_fernet = None
def get_fernet():
    global _fernet
    if _fernet is None:
        _fernet = Fernet(get_encryption_key())
    return _fernet

def encrypt_value(value: str) -> str:
    if not value:
        return value
    f = get_fernet()
    return f.encrypt(value.encode()).decode()

def decrypt_value(value: str) -> str:
    if not value:
        return value
    f = get_fernet()
    try:
        return f.decrypt(value.encode()).decode()
    except Exception:
        # Retorna o próprio valor se não puder descriptografar (retrocompatibilidade)
        return value

# --- Modelos de Dados Partilhados ---

class Room(BaseModel):
    email: str
    name: str
    logo_version: int = 0

class AppConfig(BaseModel):
    is_configured: bool = False
    admin_password_hash: str | None = None
    jwt_secret_key: str | None = None
    graph_tenant_id: str | None = None
    graph_client_id: str | None = None
    graph_client_secret: str | None = None
    rooms: list[Room] = []

# --- Instância e Funções de Gerenciamento de Configuração ---

# O diretório de trabalho no Dockerfile é /app. O config.json ficará em /app/data/config.json
# O volume do Docker Compose irá persistir o conteúdo de /app/data.
DATA_DIR = "/app/data"
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")

app_config = AppConfig()

def ensure_data_dir_exists():
    """Garante que o diretório de dados exista."""
    os.makedirs(DATA_DIR, exist_ok=True)

def load_config() -> AppConfig:
    """
    Carrega a configuração do ficheiro JSON, com lógica de repetição para resiliência
    durante o arranque do sistema. Retorna o objeto de configuração carregado.
    """
    ensure_data_dir_exists() # Garante que o diretório /app/data exista
    global app_config
    max_retries = 3
    retry_delay = 2  # segundos

    for attempt in range(max_retries):
        try:
            logging.info(f"Tentativa {attempt + 1}/{max_retries} de carregar a configuração de: {CONFIG_FILE}")

            if not os.path.exists(CONFIG_FILE):
                logging.warning("config.json não encontrado. A aplicação continuará com a configuração padrão em memória.")
                app_config = AppConfig()
                return app_config

            with open(CONFIG_FILE, "r") as f:
                # Se o ficheiro estiver vazio, o json.load() irá falhar com um erro.
                if os.fstat(f.fileno()).st_size == 0:
                    logging.warning("config.json está vazio, a tratar como não configurado.")
                    # Assume a configuração padrão, não levanta erro
                    app_config = AppConfig()
                    return app_config

                config_data = json.load(f)
                app_config = AppConfig(**config_data)
                if app_config.graph_client_secret:
                    app_config.graph_client_secret = decrypt_value(app_config.graph_client_secret)

            logging.info("Configuração carregada com sucesso.")
            return app_config # Sucesso, sai da função

        except (json.JSONDecodeError, FileNotFoundError) as e:
            logging.warning(f"Falha ao carregar/processar o config.json na tentativa {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                logging.info(f"A aguardar {retry_delay} segundos antes de tentar novamente...")
                time.sleep(retry_delay)
            else:
                logging.error("ERRO CRÍTICO: Não foi possível carregar o config.json após várias tentativas.")
                raise  # Levanta a última exceção após esgotar as tentativas

def save_config(config_to_save: AppConfig):
    """Guarda o objeto de configuração fornecido no ficheiro JSON, forçando a escrita em disco."""
    try:
        config_copy = config_to_save.model_copy(deep=True)
        if config_copy.graph_client_secret:
            config_copy.graph_client_secret = encrypt_value(config_copy.graph_client_secret)
            
        with open(CONFIG_FILE, "w") as f:
            json.dump(config_copy.model_dump(), f, indent=4)
            f.flush()
            os.fsync(f.fileno())
    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao guardar a configuração: {e}", exc_info=True)
        raise
