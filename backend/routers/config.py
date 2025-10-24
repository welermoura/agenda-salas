# backend/routers/config.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, User
from common import load_config, save_config

# Modelo Pydantic para a configuração do AD
# Os campos agora são opcionais e usam Field para melhores metadados
class ADConfig(BaseModel):
    AD_SERVER: str | None = Field(None, title="Servidor AD")
    USE_LDAPS: bool = Field(False, title="Usar LDAPS (SSL)")
    AD_DOMAIN: str | None = Field(None, title="Domínio (ex: MEUDOMINIO)")
    AD_SEARCH_BASE: str | None = Field(None, title="Base de Busca (ex: OU=Users,DC=corp,DC=com)")
    SSO_ENABLED: bool = Field(False, title="Habilitar Single Sign-On")
    DEFAULT_PASSWORD: str | None = Field(None, title="Senha Padrão para Novos Usuários")
    SERVICE_ACCOUNT_USER: str | None = Field(None, title="Usuário de Serviço")
    SERVICE_ACCOUNT_PASSWORD: str | None = Field(None, title="Senha do Usuário de Serviço")

# O roteador agora exige autenticação para todas as suas rotas
router = APIRouter(
    prefix="/api/config",
    tags=["config"],
    dependencies=[Depends(get_current_user)]
)

@router.get("/", response_model=ADConfig)
def get_config_route():
    """
    Busca as configurações do Active Directory.
    Dados sensíveis como senhas são descriptografados pela função load_config.
    """
    try:
        config_data = load_config()
        # Omitir senhas da resposta para segurança adicional
        config_data.pop('SERVICE_ACCOUNT_PASSWORD', None)
        config_data.pop('DEFAULT_PASSWORD', None)
        return config_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler a configuração: {e}")


@router.post("/")
def save_config_route(config: ADConfig, current_user: User = Depends(get_current_user)):
    """
    Salva as configurações do Active Directory.
    Dados sensíveis são criptografados pela função save_config.
    """
    # Exemplo de verificação de permissão (descomente se necessário)
    # if current_user.access_level != 'full':
    #     raise HTTPException(status_code=403, detail="Permissão negada para salvar a configuração.")

    try:
        # Pydantic converte o modelo para um dicionário
        config_dict = config.model_dump(exclude_unset=True)

        # Como as senhas não são retornadas no GET, precisamos preservá-las se não forem alteradas.
        if not config_dict.get('SERVICE_ACCOUNT_PASSWORD'):
            current_config = load_config()
            config_dict['SERVICE_ACCOUNT_PASSWORD'] = current_config.get('SERVICE_ACCOUNT_PASSWORD')

        save_config(config_dict)
        return {"message": "Configuração salva com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Não foi possível salvar a configuração: {e}")
