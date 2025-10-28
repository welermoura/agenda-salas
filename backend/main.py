from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from websocket import manager
from calendar_parser import get_room_status
import asyncio
import json
import functools

app = FastAPI()

# Configuração do CORS
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Agenda(BaseModel):
    nome: str
    url: str

# Armazenamento em memória
agendas_db: List[Agenda] = []

def carregar_agendas():
    try:
        with open("backend/agendas.json", "r") as f:
            agendas_json = json.load(f)
            agendas_db.clear()
            for agenda in agendas_json:
                agendas_db.append(Agenda(**agenda))
    except FileNotFoundError:
        pass

def salvar_agendas():
    with open("backend/agendas.json", "w") as f:
        json.dump([agenda.dict() for agenda in agendas_db], f, indent=4)

async def update_schedules_periodically():
    loop = asyncio.get_running_loop()
    while True:
        schedules = {}
        if agendas_db:
            for agenda in agendas_db:
                # Executa a função de I/O bloqueante em um executor de threads
                status = await loop.run_in_executor(
                    None, functools.partial(get_room_status, agenda.url)
                )
                schedules[agenda.url] = {"nome": agenda.nome, "status": status}

            await manager.broadcast(json.dumps(schedules))

        await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    carregar_agendas()
    asyncio.create_task(update_schedules_periodically())

import logging

logging.basicConfig(level=logging.INFO)

@app.post("/agendas", response_model=Agenda)
async def adicionar_agenda(agenda: Agenda):
    logging.info(f"Recebida solicitação para adicionar agenda: {agenda.url}")
    if any(a.url == agenda.url for a in agendas_db):
        raise HTTPException(status_code=400, detail="URL já cadastrada")
    agendas_db.append(agenda)
    salvar_agendas()

    # Adicionado para verificação imediata do status
    loop = asyncio.get_running_loop()
    status = await loop.run_in_executor(
        None, functools.partial(get_room_status, agenda.url)
    )
    await manager.broadcast(json.dumps({agenda.url: {"nome": agenda.nome, "status": status}}))

    return agenda

from urllib.parse import unquote

@app.get("/agendas", response_model=List[Agenda])
def listar_agendas():
    return agendas_db

@app.delete("/agendas/{url:path}")
def remover_agenda(url: str):
    url_decoded = unquote(url)
    agenda_removida = None
    for agenda in agendas_db:
        if agenda.url == url_decoded:
            agenda_removida = agenda
            break

    if agenda_removida:
        agendas_db.remove(agenda_removida)
        salvar_agendas()
        return {"message": "Agenda removida com sucesso"}

    raise HTTPException(status_code=404, detail="Agenda não encontrada")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        manager.disconnect(websocket)

@app.get("/")
def read_root():
    return {"message": "API de Agendas do Teams"}
