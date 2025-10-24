# backend/routers/logs.py
from fastapi import APIRouter, HTTPException
from typing import List
from logging_config import logger

router = APIRouter(
    prefix="/api/logs",
    tags=["logs"],
)

@router.get("/", response_model=List[str])
def get_logs():
    """
    Retorna as últimas linhas do arquivo de log.
    """
    logger.info("Endpoint /api/logs chamado")
    try:
        with open('ad_management.log', 'r') as f:
            lines = f.readlines()
        return lines[-100:]  # Retorna as últimas 100 linhas
    except FileNotFoundError:
        logger.warning("Arquivo de log 'ad_management.log' não encontrado.")
        return ["Arquivo de log não encontrado."]
    except Exception as e:
        logger.error(f"Erro ao ler o arquivo de log: {e}")
        raise HTTPException(status_code=500, detail="Não foi possível ler o arquivo de log.")
