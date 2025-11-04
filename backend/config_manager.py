import json
import os
import logging
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

# Constrói um caminho absoluto para o config.json, garantindo que seja sempre encontrado
# __file__ é o caminho deste ficheiro (config_manager.py)
# os.path.dirname(__file__) obtém o diretório 'backend'
# os.path.join(...) junta o diretório com o nome do ficheiro
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

app_config = AppConfig()

def load_config():
    """Carrega a configuração do ficheiro JSON para a instância global app_config."""
    global app_config
    logging.info(f"A tentar carregar o ficheiro de configuração de: {os.path.abspath(CONFIG_FILE)}")
    try:
        if os.path.exists(CONFIG_FILE):
            logging.info("Ficheiro de configuração encontrado. A ler...")
            with open(CONFIG_FILE, "r") as f:
                config_data = json.load(f)
                app_config = AppConfig(**config_data)
            logging.info("Configuração carregada com sucesso.")
        else:
            # Agora, se o ficheiro não existir, é um erro crítico, pois o deploy.sh deveria tê-lo criado.
            logging.error("ERRO CRÍTICO: config.json não encontrado! O script de deploy pode ter falhado.")
            # Opcionalmente, pode-se levantar uma exceção para impedir o arranque
            raise FileNotFoundError("config.json não foi encontrado. Execute o deploy.sh.")
    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao carregar a configuração: {e}", exc_info=True)
        raise

def save_config():
    """Guarda a instância global app_config atual no ficheiro JSON."""
    try:
        logging.info(f"A guardar a configuração em: {os.path.abspath(CONFIG_FILE)}")
        with open(CONFIG_FILE, "w") as f:
            json.dump(app_config.model_dump(), f, indent=4)
        logging.info("Configuração guardada com sucesso.")
    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao guardar a configuração: {e}", exc_info=True)
        raise
