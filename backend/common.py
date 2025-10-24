# backend/common.py
import os
import json
import logging
from ldap3 import Server, Connection, ALL
from ldap3.utils.conv import escape_filter_chars
from cryptography.fernet import Fernet
from datetime import datetime, timezone

# ==============================================================================
# Configuração Base
# ==============================================================================
basedir = os.path.abspath(os.path.dirname(__file__))
# O diretório 'data' ficará na raiz do projeto para consistência.
data_dir = os.path.join(basedir, '..', 'data')
os.makedirs(data_dir, exist_ok=True)

CONFIG_FILE = os.path.join(data_dir, 'config.json')
KEY_FILE = os.path.join(data_dir, 'secret.key')
PERMISSIONS_FILE = os.path.join(data_dir, 'permissions.json')
SCHEDULE_FILE = os.path.join(data_dir, 'schedules.json')
DISABLE_SCHEDULE_FILE = os.path.join(data_dir, 'disable_schedules.json')
GROUP_SCHEDULE_FILE = os.path.join(data_dir, 'group_schedules.json')


SENSITIVE_KEYS = ['DEFAULT_PASSWORD', 'SERVICE_ACCOUNT_PASSWORD']

# ==============================================================================
# Funções de Criptografia e Configuração
# ==============================================================================
def write_key():
    """Gera uma chave de criptografia e a salva no KEY_FILE."""
    key = Fernet.generate_key()
    with open(KEY_FILE, "wb") as key_file:
        key_file.write(key)
    return key

def load_key():
    """Carrega a chave de criptografia do KEY_FILE. Se não existir, cria uma."""
    if not os.path.exists(KEY_FILE):
        return write_key()
    with open(KEY_FILE, "rb") as key_file:
        return key_file.read()

# Carrega a chave na inicialização do módulo
key = load_key()
cipher_suite = Fernet(key)

def load_config():
    """Carrega, descriptografa e retorna os dados de configuração do CONFIG_FILE."""
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            encrypted_config = json.load(f)

        config = {}
        for k, v in encrypted_config.items():
            if k in SENSITIVE_KEYS and v:
                try:
                    config[k] = cipher_suite.decrypt(v.encode()).decode()
                except Exception: # Se falhar, assume que não estava criptografado
                    config[k] = v
            else:
                config[k] = v
        return config
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_config(config_data: dict):
    """Criptografa dados sensíveis e salva a configuração no CONFIG_FILE."""
    encrypted_config = {}
    for k, v in config_data.items():
        if k in SENSITIVE_KEYS and v:
            encrypted_config[k] = cipher_suite.encrypt(v.encode()).decode()
        else:
            encrypted_config[k] = v

    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(encrypted_config, f, indent=4)

# ==============================================================================
# Funções de Conexão e Lógica AD
# ==============================================================================
def get_ldap_connection(user: str = None, password: str = None) -> Connection:
    """
    Cria e retorna uma conexão LDAP.
    Se 'user' e 'password' forem fornecidos, usa-os para a conexão.
    Caso contrário, usa a conta de serviço definida no config.json.
    """
    config = load_config()
    ad_server = config.get('AD_SERVER')
    use_ldaps = config.get('USE_LDAPS', False)
    if not ad_server:
        raise ValueError("Servidor AD não configurado.")

    server = Server(ad_server, use_ssl=use_ldaps, get_info=ALL)

    if user and password:
        return Connection(server, user=user, password=password, auto_bind=True)
    else:
        service_user = config.get('SERVICE_ACCOUNT_USER')
        service_password = config.get('SERVICE_ACCOUNT_PASSWORD')
        if not service_user or not service_password:
            raise ValueError("Conta de serviço não configurada para a operação.")
        return Connection(server, user=service_user, password=service_password, auto_bind=True)

def filetime_to_datetime(ft: str) -> datetime | None:
    """Converte um timestamp Microsoft FILETIME para um objeto datetime do Python."""
    EPOCH_AS_FILETIME = 116444736000000000
    HUNDREDS_OF_NANOSECONDS = 10000000
    if ft is None or int(ft) == 0 or int(ft) == 9223372036854775807:
        return None
    return datetime.fromtimestamp((int(ft) - EPOCH_AS_FILETIME) / HUNDREDS_OF_NANOSECONDS, tz=timezone.utc)

def get_user_by_dn(conn: Connection, user_dn: str, attributes=None):
    """Busca um usuário ou objeto diretamente pelo seu Distinguished Name (DN)."""
    if attributes is None:
        attributes = ALL
    try:
        conn.search(user_dn, '(objectClass=*)', search_scope=ldap3.BASE, attributes=attributes)
        if conn.entries:
            return conn.entries[0]
    except ldap3.core.exceptions.LDAPNoSuchObjectResult:
        return None
    return None

def get_user_by_samaccountname(conn: Connection, sam_account_name: str, attributes=None):
    """Busca um usuário pelo seu sAMAccountName."""
    if attributes is None:
        attributes = ALL
    config = load_config()
    search_base = config.get('AD_SEARCH_BASE', conn.server.info.other['defaultNamingContext'][0])
    conn.search(search_base, f'(sAMAccountName={escape_filter_chars(sam_account_name)})', attributes=attributes)
    return conn.entries[0] if conn.entries else None

def get_group_by_name(conn: Connection, group_name: str, attributes=None):
    """Busca um grupo pelo seu nome (cn)."""
    if attributes is None:
        attributes = ALL
    config = load_config()
    search_base = config.get('AD_SEARCH_BASE', conn.server.info.other['defaultNamingContext'][0])
    conn.search(search_base, f'(&(objectClass=group)(cn={escape_filter_chars(group_name)}))', attributes=attributes)
    return conn.entries[0] if conn.entries else None

def get_user_access_level(user_groups: list) -> str:
    """Determina o nível de acesso de um usuário com base em seus grupos."""
    permissions = load_permissions()
    if not user_groups or not permissions:
        return 'none'

    access_levels = {'none'}
    for group in user_groups:
        rule = permissions.get(group, {})
        access_levels.add(rule.get('type', 'none'))

    if 'full' in access_levels:
        return 'full'
    if 'custom' in access_levels:
        return 'custom'
    return 'none'

def load_permissions():
    """Carrega as permissões do arquivo JSON."""
    try:
        with open(PERMISSIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
