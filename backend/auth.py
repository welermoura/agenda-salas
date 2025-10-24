# backend/auth.py
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from common import get_user_by_samaccountname, load_config, get_ldap_connection, get_user_access_level

# ==============================================================================
# Configuração de Segurança
# ==============================================================================
config = load_config()
SECRET_KEY = config.get("SECRET_KEY", "default_secret_key_for_dev") # Carrega a chave do config ou usa uma padrão
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 horas

# Esquema OAuth2 para o cabeçalho 'Authorization: Bearer <token>'
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

# ==============================================================================
# Modelos de Dados (Pydantic)
# ==============================================================================
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None

class User(BaseModel):
    username: str
    displayName: str
    access_level: str
    groups: list[str]

# ==============================================================================
# Funções de Autenticação e Token
# ==============================================================================
def create_access_token(data: dict):
    """Cria um novo token de acesso JWT."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Dependência do FastAPI para validar o token e retornar os dados do usuário.
    Esta função será usada para proteger os endpoints da API.
    """
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception

        # Busca o usuário no AD para garantir que ele ainda é válido
        conn = get_ldap_connection() # Usa a conta de serviço para esta verificação
        user_ad_details = get_user_by_samaccountname(conn, username, attributes=['memberOf', 'displayName', 'sAMAccountName'])

        if user_ad_details is None:
            raise credentials_exception

        user_groups = [g.split(',')[0].split('=')[1] for g in user_ad_details.memberOf.values] if 'memberOf' in user_ad_details and user_ad_details.memberOf.value else []
        access_level = get_user_access_level(user_groups)

        user = User(
            username=user_ad_details.sAMAccountName.value,
            displayName=user_ad_details.displayName.value,
            access_level=access_level,
            groups=user_groups
        )
        return user

    except jwt.PyJWTError:
        raise credentials_exception
