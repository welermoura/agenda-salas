# backend/routers/config.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, User
from common import load_config, save_config

# ==============================================================================
# Modelo Pydantic para a Configuração do AD
# ==============================================================================
# Este modelo agora corresponde exatamente ao que o frontend envia.
# Usamos 'alias' para mapear os nomes do JSON (ex: 'server') para os nomes
# que usamos internamente no Python (ex: 'ad_server').
class ADConfig(BaseModel):
    server: str | None = Field(None, alias='AD_SERVER')
    port: int | None = Field(None, alias='AD_PORT') # Supondo que a porta também pode vir
    user: str | None = Field(None, alias='SERVICE_ACCOUNT_USER')
    password: str | None = Field(None, alias='SERVICE_ACCOUNT_PASSWORD')
    base_dn: str | None = Field(None, alias='AD_SEARCH_BASE')
    domain: str | None = Field(None, alias='AD_DOMAIN')

    # Permite que o Pydantic popule o modelo usando os aliases
    class Config:
        populate_by_name = True

# O roteador agora exige autenticação para todas as suas rotas
router = APIRouter(
    prefix="/api/config",
    tags=["config"]
    # A dependência de autenticação foi removida para permitir a configuração inicial
)

@router.get("/", response_model=ADConfig, response_model_by_alias=False)
def get_config_route():
    """
    Busca as configurações do Active Directory.
    'response_model_by_alias=False' garante que o JSON retornado use os nomes de campo
    do Python (server, port, etc.), que é o que o frontend espera.
    """
    try:
        config_data = load_config()
        # Omitir senhas da resposta para segurança
        config_data.pop('SERVICE_ACCOUNT_PASSWORD', None)
        config_data.pop('DEFAULT_PASSWORD', None)
        return config_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler a configuração: {e}")

@router.post("/")
def save_config_route(config: ADConfig):
    """
    Salva as configurações do Active Directory.
    O Pydantic irá mapear automaticamente o JSON recebido para os aliases.
    """
    try:
        # Converte o modelo para um dicionário, usando os aliases como chaves.
        # 'exclude_unset=True' garante que apenas os campos enviados sejam atualizados.
        update_data = config.model_dump(by_alias=True, exclude_unset=True)

        # Carrega a configuração atual para preservar valores não alterados
        current_config = load_config()

        # Mescla a configuração atual com os novos dados
        current_config.update(update_data)

        save_config(current_config)
        return {"message": "Configuração salva com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Não foi possível salvar a configuração: {e}")
