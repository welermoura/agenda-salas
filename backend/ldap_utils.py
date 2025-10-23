# backend/ldap_utils.py
# Este arquivo pode ser usado para futuras funções de utilidade LDAP.
import ldap
from fastapi import HTTPException
from .config import LDAP_SERVER, LDAP_BIND_USER, LDAP_BIND_PASSWORD
from .logging_config import logger

def get_ldap_connection():
    """Estabelece e retorna uma conexão LDAP."""
    try:
        conn = ldap.initialize(LDAP_SERVER)
        conn.simple_bind_s(LDAP_BIND_USER, LDAP_BIND_PASSWORD)
        return conn
    except ldap.LDAPError as e:
        logger.error(f"Falha ao conectar ao servidor LDAP: {e}")
        raise HTTPException(status_code=503, detail="Não foi possível conectar ao servidor LDAP.")
