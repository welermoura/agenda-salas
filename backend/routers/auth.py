# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from ldap3.core.exceptions import LDAPInvalidCredentialsResult

from auth import create_access_token, Token
from common import get_ldap_connection, load_config

router = APIRouter(
    prefix="/api",
    tags=["authentication"],
)

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Endpoint para obter um token JWT.
    O frontend deve enviar os dados como 'form data' (não JSON) com as chaves 'username' e 'password'.
    """
    config = load_config()
    ad_domain = config.get('AD_DOMAIN')
    if not ad_domain:
        raise HTTPException(status_code=500, detail="Domínio AD não configurado no servidor.")

    full_username = f"{ad_domain}\\{form_data.username}"

    try:
        # Tenta autenticar no AD com as credenciais fornecidas
        get_ldap_connection(user=full_username, password=form_data.password)
    except LDAPInvalidCredentialsResult:
        raise HTTPException(
            status_code=401,
            detail="Nome de usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # Captura outros erros de conexão
        raise HTTPException(status_code=503, detail=f"Não foi possível conectar ao servidor AD: {e}")

    # Se a autenticação for bem-sucedida, cria o token JWT
    access_token = create_access_token(
        data={"sub": form_data.username} # 'sub' é o campo padrão para o identificador do usuário em JWT
    )

    return {"access_token": access_token, "token_type": "bearer"}
