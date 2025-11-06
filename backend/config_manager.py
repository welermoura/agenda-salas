import json
import os
import logging
import time
from pydantic import BaseModel

# --- Modelos de Dados Partilhados ---

class Room(BaseModel):
    email: str
    name: str

class AppConfig(BaseModel):
    is_configured: bool = False
    admin_password_hash: str | None = None
    jwt_secret_key: str | None = None
    graph_tenant_id: str | None = None
    graph_client_id: str | None = None
    graph_client_secret: str | None = None
    rooms: list[Room] = []

# --- Instância e Funções de Gerenciamento de Configuração ---

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

app_config = AppConfig()

def load_config():
    """
    Carrega a configuração do ficheiro JSON, com lógica de repetição para resiliência
    durante o arranque do sistema.
    """
    global app_config
    max_retries = 3
    retry_delay = 2  # segundos

    for attempt in range(max_retries):
        try:
            logging.info(f"Tentativa {attempt + 1}/{max_retries} de carregar a configuração de: {CONFIG_FILE}")

            if not os.path.exists(CONFIG_FILE):
                logging.warning("config.json não encontrado. A aplicação continuará com a configuração padrão em memória.")
                app_config = AppConfig()
                return

            with open(CONFIG_FILE, "r") as f:
                # Se o ficheiro estiver vazio, o json.load() irá falhar com um erro.
                if os.fstat(f.fileno()).st_size == 0:
                    logging.warning("config.json está vazio, a tratar como não configurado.")
                    # Assume a configuração padrão, não levanta erro
                    app_config = AppConfig()
                    return

                config_data = json.load(f)
                app_config = AppConfig(**config_data)

            logging.info("Configuração carregada com sucesso.")
            return  # Sucesso, sai da função

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
        with open(CONFIG_FILE, "w") as f:
            json.dump(config_to_save.model_dump(), f, indent=4)
            f.flush()
            os.fsync(f.fileno())
    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao guardar a configuração: {e}", exc_info=True)
        raise
