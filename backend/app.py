# backend/app.py
from fastapi import FastAPI, Request
from .logging_config import logger
from .routers import users, groups, logs, config

app = FastAPI(
    title="AD Management Tool API",
    description="API para gerenciar o Active Directory",
    version="0.1.0"
)

# --- Middleware para logar todas as requisições ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Requisição recebida: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Resposta enviada: {response.status_code}")
    return response

# --- Incluir os roteadores ---
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(logs.router)
app.include_router(config.router)

@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API da Ferramenta de Gestão de Active Directory"}
