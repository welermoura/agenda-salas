# backend/ldap_utils.py
import ldap
from fastapi import HTTPException
import json
from .logging_config import logger

CONFIG_FILE = "backend/config.json"

def _load_ldap_config():
    """Carrega a configuração LDAP do arquivo JSON."""
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"Arquivo de configuração '{CONFIG_FILE}' não encontrado. A aplicação não pode conectar ao LDAP.")
        raise HTTPException(status_code=503, detail=f"Arquivo de configuração '{CONFIG_FILE}' não encontrado.")
    except json.JSONDecodeError:
        logger.error(f"Erro ao decodificar o arquivo JSON '{CONFIG_FILE}'. Verifique se o formato está correto.")
        raise HTTPException(status_code=500, detail="Erro ao ler o arquivo de configuração.")
    except Exception as e:
        logger.error(f"Erro inesperado ao carregar a configuração: {e}")
        raise HTTPException(status_code=500, detail="Erro inesperado ao carregar a configuração.")


def get_ldap_connection():
    """Estabelece e retorna uma conexão LDAP usando as configurações do config.json."""
    config = _load_ldap_config()

    ldap_uri = f"{config['server']}:{config['port']}"
    bind_user = config['user']
    bind_password = config['password']

    try:
        conn = ldap.initialize(ldap_uri)
        conn.simple_bind_s(bind_user, bind_password)
        logger.info("Conexão LDAP estabelecida com sucesso.")
        return conn
    except ldap.LDAPError as e:
        logger.error(f"Falha ao conectar ou autenticar no servidor LDAP ({ldap_uri}): {e}")
        raise HTTPException(status_code=503, detail=f"Não foi possível conectar ou autenticar no servidor LDAP: {e}")

def get_base_dn():
    """Retorna o Base DN da configuração."""
    config = _load_ldap_config()
    return config.get('base_dn', '')
