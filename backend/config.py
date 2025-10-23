# backend/config.py
import os
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações do servidor LDAP
LDAP_SERVER = os.getenv("LDAP_SERVER", "ldaps://your-ad-server.com")
LDAP_PORT = int(os.getenv("LDAP_PORT", 636))
LDAP_BASE_DN = os.getenv("LDAP_BASE_DN", "dc=your-domain,dc=com")

# Conta de serviço para autenticação
LDAP_BIND_USER = os.getenv("LDAP_BIND_USER", "cn=admin,dc=your-domain,dc=com")
LDAP_BIND_PASSWORD = os.getenv("LDAP_BIND_PASSWORD", "your-password")
