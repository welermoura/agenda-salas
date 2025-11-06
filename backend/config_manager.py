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

# --- ALTERAÇÃO DE DIAGNÓSTICO TEMPORÁRIA ---
# O caminho do ficheiro foi alterado para /tmp para verificar se a aplicação
# consegue escrever em qualquer local do disco.
# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
CONFIG_FILE = "/tmp/config.json"


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
                # O ficheiro será criado na primeira vez que a configuração for guardada.
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

def save_config():
    """Guarda a instância global app_config atual no ficheiro JSON, forçando a escrita em disco."""
    config_path = os.path.abspath(CONFIG_FILE)
    logging.info(f"A iniciar o processo de guardar a configuração. Caminho absoluto do ficheiro: {config_path}")

    try:
        logging.info("A tentar escrever no ficheiro...")
        with open(config_path, "w") as f:
            json.dump(app_config.model_dump(), f, indent=4)
            f.flush()  # Força a escrita do buffer interno do Python para o buffer do SO
            os.fsync(f.fileno())  # Solicita ao SO que escreva o buffer para o disco
        logging.info(f"Configuração guardada e sincronizada com o disco com sucesso em {config_path}.")
    except PermissionError as e:
        logging.error(f"ERRO DE PERMISSÃO ao guardar em {config_path}: {e}. Verifique as permissões de escrita para o utilizador que executa o serviço.")
        raise
    except IOError as e:
        logging.error(f"ERRO DE I/O ao guardar em {config_path}: {e}", exc_info=True)
        raise
    except Exception as e:
        logging.error(f"ERRO CRÍTICO inesperado ao guardar a configuração em {config_path}: {e}", exc_info=True)
        raise
