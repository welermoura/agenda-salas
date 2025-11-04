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
    graph_tenant_id: str | None = None
    graph_client_id: str | None = None
    graph_client_secret: str | None = None
    rooms: list[Room] = []

# --- Instância e Funções de Gerenciamento de Configuração ---

def _get_config_path():
    """
    Determina o caminho para o ficheiro de configuração.
    Prioriza a variável de ambiente CONFIG_FILE_PATH.
    Caso contrário, assume que o ficheiro está na raiz do projeto, um nível acima deste script.
    """
    env_path = os.getenv("CONFIG_FILE_PATH")
    if env_path:
        return env_path

    # Constrói o caminho para a raiz do projeto (um nível acima do diretório 'backend')
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(backend_dir)
    default_path = os.path.join(project_root, "config.json")
    return default_path

CONFIG_FILE = _get_config_path()
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
                # O ficheiro deve existir. Se não existir, é um erro de deploy.
                raise FileNotFoundError("config.json não foi encontrado. O script de deploy pode ter falhado.")

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

def save_config():
    """Guarda a instância global app_config atual no ficheiro JSON, forçando a escrita em disco."""
    try:
        logging.info(f"A guardar a configuração em: {CONFIG_FILE}")
        with open(CONFIG_FILE, "w") as f:
            json.dump(app_config.model_dump(), f, indent=4)
            f.flush()
            os.fsync(f.fileno())
        logging.info("Configuração guardada e sincronizada com o disco com sucesso.")
    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao guardar a configuração: {e}", exc_info=True)
        raise
