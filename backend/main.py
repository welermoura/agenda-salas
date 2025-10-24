from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from backend.websocket import manager
from backend.calendar_parser import get_room_status
import asyncio
import json

app = FastAPI()

# Configuração do CORS
origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Agenda(BaseModel):
    url: str

# Armazenamento em memória
agendas_db: List[Agenda] = []

async def update_schedules_periodically():
    while True:
        schedules = {}
        if agendas_db:
            for agenda in agendas_db:
                status = get_room_status(agenda.url)
                schedules[agenda.url] = status

            await manager.broadcast(json.dumps(schedules))

        await asyncio.sleep(60) # Atualiza a cada 60 segundos

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(update_schedules_periodically())

from fastapi import HTTPException

@app.post("/agendas", response_model=Agenda)
def adicionar_agenda(agenda: Agenda):
    if any(a.url == agenda.url for a in agendas_db):
        raise HTTPException(status_code=400, detail="URL já cadastrada")
    agendas_db.append(agenda)
    return agenda

@app.get("/agendas", response_model=List[Agenda])
def listar_agendas():
    return agendas_db

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception as e:
        print(e)
    finally:
        manager.disconnect(websocket)

@app.get("/")
def read_root():
    return {"message": "API de Agendas do Teams"}
