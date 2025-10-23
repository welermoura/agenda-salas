# backend/routers/config.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from ..logging_config import logger

router = APIRouter(
    prefix="/api/config",
    tags=["config"],
)

CONFIG_FILE = "backend/config.json"

class ADConfig(BaseModel):
    server: str
    port: int
    user: str
    password: str
    base_dn: str

@router.post("/")
def save_config(config: ADConfig):
    """
    Salva as configurações do Active Directory em um arquivo JSON.
    """
    logger.info("Recebida requisição para salvar a configuração do AD.")
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config.dict(), f, indent=4)
        logger.info(f"Configuração salva com sucesso em '{CONFIG_FILE}'.")
        return {"message": "Configuração salva com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao salvar o arquivo de configuração: {e}")
        raise HTTPException(status_code=500, detail="Não foi possível salvar a configuração.")

@router.get("/", response_model=ADConfig)
def get_config():
    """
    Busca as configurações do Active Directory do arquivo JSON.
    """
    logger.info("Recebida requisição para buscar a configuração do AD.")
    try:
        with open(CONFIG_FILE, 'r') as f:
            config_data = json.load(f)
        logger.info("Configuração lida com sucesso.")
        return config_data
    except FileNotFoundError:
        logger.warning(f"Arquivo de configuração '{CONFIG_FILE}' não encontrado.")
        raise HTTPException(status_code=404, detail="Arquivo de configuração não encontrado.")
    except Exception as e:
        logger.error(f"Erro ao ler o arquivo de configuração: {e}")
        raise HTTPException(status_code=500, detail="Não foi possível ler a configuração.")
