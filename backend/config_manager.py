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

app_config = AppConfig()
_config_file_path = None

def get_config_path():
    """
    Obtém o caminho para o config.json a partir de uma variável de ambiente,
    com um fallback para desenvolvimento local.
    """
    global _config_file_path
    if _config_file_path:
        return _config_file_path

    prod_path = os.getenv("CONFIG_FILE_PATH")
    if prod_path:
        _config_file_path = prod_path
        return prod_path

    logging.warning("A variável de ambiente 'CONFIG_FILE_PATH' não está definida. A usar o caminho de fallback para desenvolvimento.")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    _config_file_path = os.path.join(base_dir, "config.json")
    return _config_file_path

def load_config():
    """
    Carrega a configuração do ficheiro JSON. Deve ser chamada no arranque da aplicação.
    """
    global app_config
    config_file = get_config_path()
    max_retries = 3
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            logging.info(f"Tentativa {attempt + 1}/{max_retries} de carregar a configuração de: {config_file}")

            if not os.path.exists(config_file):
                raise FileNotFoundError(f"{config_file} não foi encontrado. O script de deploy pode ter falhado.")

            with open(config_file, "r") as f:
                if os.fstat(f.fileno()).st_size == 0:
                    logging.warning(f"{config_file} está vazio, a tratar como não configurado.")
                    app_config = AppConfig()
                    return

                config_data = json.load(f)
                app_config = AppConfig(**config_data)
            logging.info("Configuração carregada com sucesso.")
            return

        except (json.JSONDecodeError, FileNotFoundError) as e:
            logging.warning(f"Falha ao carregar/processar o {config_file} na tentativa {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                logging.error(f"ERRO CRÍTICO: Não foi possível carregar o {config_file} após várias tentativas.")
                raise

def save_config():
    """
    Guarda a instância de configuração atual num ficheiro JSON usando uma escrita atómica.
    """
    config_file = get_config_path()
    temp_file = config_file + ".tmp"
    try:
        logging.info(f"A iniciar a escrita atómica da configuração em: {config_file}")

        with open(temp_file, "w") as f:
            json.dump(app_config.model_dump(), f, indent=4)
            f.flush()
            os.fsync(f.fileno())

        os.rename(temp_file, config_file)

        logging.info("Configuração guardada com sucesso usando escrita atómica.")

    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao guardar a configuração: {e}", exc_info=True)
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
                logging.info(f"Ficheiro temporário de configuração ({temp_file}) removido.")
            except OSError as remove_e:
                logging.error(f"Não foi possível remover o ficheiro temporário {temp_file}: {remove_e}")
        raise
