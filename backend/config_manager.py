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

def get_config_path():
    """
    Obtém o caminho para o config.json a partir de uma variável de ambiente,
    com um fallback para desenvolvimento local.
    """
    # Para produção, o caminho DEVE ser definido via variável de ambiente
    prod_path = os.getenv("CONFIG_FILE_PATH")
    if prod_path:
        return prod_path

    # Fallback para desenvolvimento local (executando de dentro do diretório 'backend')
    logging.warning("A variável de ambiente 'CONFIG_FILE_PATH' não está definida. A usar o caminho de fallback para desenvolvimento.")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "config.json")

CONFIG_FILE = get_config_path()
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
    """
    Guarda a instância de configuração atual num ficheiro JSON usando uma escrita atómica
    para prevenir a corrupção de dados.
    """
    TEMP_FILE = CONFIG_FILE + ".tmp"
    try:
        logging.info(f"A iniciar a escrita atómica da configuração em: {CONFIG_FILE}")

        # Passo 1: Escrever a nova configuração num ficheiro temporário
        with open(TEMP_FILE, "w") as f:
            json.dump(app_config.model_dump(), f, indent=4)
            f.flush()
            os.fsync(f.fileno()) # Garante que os dados são escritos no disco

        # Passo 2: Renomear (mover) atomicamente o ficheiro temporário para o ficheiro final
        os.rename(TEMP_FILE, CONFIG_FILE)

        logging.info("Configuração guardada com sucesso usando escrita atómica.")

    except Exception as e:
        logging.error(f"ERRO CRÍTICO ao guardar a configuração: {e}", exc_info=True)
        # Se algo falhar, tenta remover o ficheiro temporário se ele existir
        if os.path.exists(TEMP_FILE):
            try:
                os.remove(TEMP_FILE)
                logging.info(f"Ficheiro temporário de configuração ({TEMP_FILE}) removido.")
            except OSError as remove_e:
                logging.error(f"Não foi possível remover o ficheiro temporário {TEMP_FILE}: {remove_e}")
        raise
