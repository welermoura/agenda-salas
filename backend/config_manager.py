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
    secret_key: str | None = None
    graph_tenant_id: str | None = None
    graph_client_id: str | None = None
    graph_client_secret: str | None = None
    rooms: list[Room] = []

# --- Instância e Funções de Gerenciamento de Configuração ---

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

app_config = AppConfig()

def load_config():
    """Carrega a configuração do ficheiro JSON para a instância global app_config."""
    global app_config
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                config_data = json.load(f)
                app_config = AppConfig(**config_data)
        else:
            msg = "ERRO CRÍTICO: config.json não encontrado! Execute o deploy.sh."
            logging.error(msg)
            raise FileNotFoundError(msg)
    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao carregar a configuração: {e}", exc_info=True)
        raise

def save_config():
    """
    Guarda a instância global app_config de forma atómica para prevenir corrupção.
    Escreve num ficheiro temporário e depois renomeia-o.
    """
    temp_file = f"{CONFIG_FILE}.tmp"
    try:

    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao guardar a configuração: {e}", exc_info=True)
        # Tenta limpar o ficheiro temporário em caso de erro
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
                logging.info(f"Ficheiro temporário '{temp_file}' removido.")
            except OSError as cleanup_error:
                logging.error(f"Falha ao remover o ficheiro temporário '{temp_file}': {cleanup_error}")
        raise
