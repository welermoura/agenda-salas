from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import json
import asyncio
import aiofiles
from typing import List, Dict

# Importa a lógica de parsing do calendário
from calendar_parser import get_room_status

# --- Configuração do App FastAPI ---
app = FastAPI()

origins = ["*"]  # Para desenvolvimento local, aceita todas as origens

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Modelos de Dados ---
class Agenda(BaseModel):
    nome: str
    url: HttpUrl

# --- Gerenciamento de Dados ---
AGENDAS_FILE = "backend/agendas.json"

async def carregar_agendas() -> List[Agenda]:
    try:
        async with aiofiles.open(AGENDAS_FILE, mode='r') as f:
            content = await f.read()
            if not content:
                return []
            data = json.loads(content)
            return [Agenda(**item) for item in data]
    except (FileNotFoundError, json.JSONDecodeError):
        return []

async def salvar_agendas(agendas: List[Agenda]):
    async with aiofiles.open(AGENDAS_FILE, mode='w') as f:
        # Garante que a URL seja convertida para string antes de salvar
        agendas_list = [{"nome": a.nome, "url": str(a.url)} for a in agendas]
        await f.write(json.dumps(agendas_list, indent=4))

# --- Gerenciador de WebSocket ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# --- Tarefa de Atualização em Background ---
async def update_scheduler():
    while True:
        try:
            agendas = await carregar_agendas()
            statuses = {}
            if agendas:
                for agenda in agendas:
                    try:
                        status = get_room_status(str(agenda.url))
                        statuses[str(agenda.url)] = {"nome": agenda.nome, "status": status}
                    except Exception:
                        # Se a busca por um calendário específico falhar, pula para o próximo
                        # O erro poderia ser logado em um sistema de monitoramento real
                        pass

                if statuses:
                    await manager.broadcast(json.dumps(statuses))

        except Exception:
            # Captura qualquer outra exceção inesperada no loop principal
            # para garantir que a tarefa nunca pare de ser executada.
            # Em um ambiente de produção, isso seria um log de erro crítico.
            pass

        await asyncio.sleep(10) # Intervalo de atualização

@app.on_event("startup")
async def startup_event():
    # Inicia a tarefa de atualização em background
    asyncio.create_task(update_scheduler())

# --- Endpoints da API ---
@app.get("/agendas", response_model=List[Agenda])
async def get_agendas():
    return await carregar_agendas()

@app.post("/agendas", status_code=201)
async def add_agenda(agenda: Agenda):
    agendas = await carregar_agendas()
    if any(a.url == agenda.url for a in agendas):
        return {"error": "URL já cadastrada."} # Adicionado feedback de erro
    agendas.append(agenda)
    await salvar_agendas(agendas)
    return agenda

@app.delete("/agendas/{url:path}", status_code=204)
async def delete_agenda(url: str):
    agendas = await carregar_agendas()
    agendas_filtradas = [a for a in agendas if str(a.url) != url]
    await salvar_agendas(agendas_filtradas)

# --- Endpoint WebSocket ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Envia o estado atual assim que o cliente se conecta, mesmo que esteja vazio
        agendas = await carregar_agendas()
        statuses = {}
        for agenda in agendas:
            try:
                status = get_room_status(str(agenda.url))
                statuses[str(agenda.url)] = {"nome": agenda.nome, "status": status}
            except Exception as e:
                statuses[str(agenda.url)] = {"nome": agenda.nome, "status": {"error": str(e)}}
        await websocket.send_text(json.dumps(statuses))

        while True:
            # Mantém a conexão aberta para receber broadcasts
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        # Log do erro no servidor
        print(f"Erro no WebSocket: {e}")
        manager.disconnect(websocket)

@app.get("/")
def read_root():
    return {"message": "Backend is running"}
