import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime
import secrets

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# --- Novos imports para segurança e configuração ---
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext

# Importa a lógica de configuração e os modelos partilhados
import config_manager
from config_manager import Room, load_config, save_config
import calendar_parser

# --- Segurança e Autenticação ---
SECRET_KEY = None  # Carregado a partir do config.json no arranque
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def verify_password(plain_password, hashed_password):
    # Aplica a mesma lógica de truncamento usada no hashing
    password_bytes = plain_password.encode('utf-8')
    truncated_password = password_bytes[:72]
    return pwd_context.verify(truncated_password, hashed_password)

def get_password_hash(password):
    # Trunca a password para 72 bytes, que é o limite do bcrypt
    password_bytes = password.encode('utf-8')
    truncated_password = password_bytes[:72]
    return pwd_context.hash(truncated_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return username


# --- Lógica de atualização em segundo plano ---
async def update_scheduler():
    while True:
        try:
            if config_manager.app_config.is_configured and config_manager.app_config.rooms:
                today_str = datetime.now().strftime('%Y-%m-%d')
                statuses = {}
                for room in config_manager.app_config.rooms:
                    status = calendar_parser.get_room_status(room, today_str)
                    statuses[room.email] = status

                await manager.broadcast(json.dumps({"date": today_str, "statuses": statuses}))

            await asyncio.sleep(3)
        except Exception as e:
            logging.error(f"Erro no loop de atualização do scheduler: {e}", exc_info=True)
            # Em caso de erro (ex: falha de rede), espera mais para evitar spam
            await asyncio.sleep(60)


# --- Ciclo de Vida da Aplicação ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO)
    global SECRET_KEY
    # Carrega a configuração e reatribui a variável global no módulo config_manager
    config_manager.app_config = load_config()

    if config_manager.app_config.is_configured:
        SECRET_KEY = config_manager.app_config.jwt_secret_key
        loop = asyncio.get_event_loop()
        loop.create_task(update_scheduler())
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoints de Setup ---
class SetupData(BaseModel):
    admin_password: str
    tenant_id: str
    client_id: str
    client_secret: str

@app.get("/api/setup/status")
async def get_setup_status():
    return {"is_configured": config_manager.app_config.is_configured}

@app.post("/api/setup/initialize")
async def initialize_setup(data: SetupData):
    logging.info("Endpoint /api/setup/initialize alcançado. A iniciar o processo de configuração.")
    global SECRET_KEY
    if config_manager.app_config.is_configured:
        logging.warning("Tentativa de configurar uma aplicação já configurada.")
        raise HTTPException(status_code=403, detail="Application is already configured.")

    try:
        # Gera e guarda a chave secreta JWT
        config_manager.app_config.jwt_secret_key = secrets.token_urlsafe(32)
        SECRET_KEY = config_manager.app_config.jwt_secret_key # Define a chave para a sessão atual
        logging.info("Chave secreta JWT gerada.")

        config_manager.app_config.admin_password_hash = get_password_hash(data.admin_password)
        logging.info("Hash da palavra-passe de administrador gerado.")

        config_manager.app_config.graph_tenant_id = data.tenant_id
        config_manager.app_config.graph_client_id = data.client_id
        config_manager.app_config.graph_client_secret = data.client_secret
        config_manager.app_config.is_configured = True
        logging.info("Dados de configuração aplicados ao objeto app_config.")

        logging.info("A chamar save_config() para persistir as alterações...")
        save_config(config_manager.app_config)
        logging.info("save_config() chamado com sucesso.")

        loop = asyncio.get_event_loop()
        loop.create_task(update_scheduler())
        logging.info("Tarefa de atualização em segundo plano iniciada.")

        return {"message": "Setup complete. Please log in."}
    except Exception as e:
        logging.error(f"ERRO CRÍTICO durante o processo de setup em initialize_setup: {e}", exc_info=True)
        # Levanta uma exceção HTTP para garantir que o cliente recebe um erro claro
        raise HTTPException(status_code=500, detail="Ocorreu um erro interno durante o setup.")

# --- Endpoints de Autenticação e Admin ---
@app.post("/api/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    if not config_manager.app_config.is_configured or not verify_password(form_data.password, config_manager.app_config.admin_password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
    access_token = create_access_token(data={"sub": form_data.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/rooms", response_model=list[Room])
async def get_rooms(current_user: str = Depends(get_current_user)):
    return config_manager.app_config.rooms

@app.post("/api/rooms")
async def update_rooms(rooms: list[Room], current_user: str = Depends(get_current_user)):
    config_manager.app_config.rooms = rooms
    save_config(config_manager.app_config)
    return {"message": "Rooms updated successfully."}

class GraphConfig(BaseModel):
    tenant_id: str
    client_id: str
    client_secret: str | None = None

@app.get("/api/config", response_model=GraphConfig)
async def get_graph_config(current_user: str = Depends(get_current_user)):
    # Retorna a configuração SEM o client_secret por segurança
    return GraphConfig(
        tenant_id=config_manager.app_config.graph_tenant_id,
        client_id=config_manager.app_config.graph_client_id
    )

@app.post("/api/config")
async def update_graph_config(config: GraphConfig, current_user: str = Depends(get_current_user)):
    config_manager.app_config.graph_tenant_id = config.tenant_id
    config_manager.app_config.graph_client_id = config.client_id
    # Atualiza o segredo apenas se um novo valor não-vazio for fornecido
    if config.client_secret:
        config_manager.app_config.graph_client_secret = config.client_secret
    save_config(config_manager.app_config)
    return {"message": "Graph configuration updated successfully."}

class PasswordChange(BaseModel):
    new_password: str

@app.post("/api/change-password")
async def change_password(password_data: PasswordChange, current_user: str = Depends(get_current_user)):
    config_manager.app_config.admin_password_hash = get_password_hash(password_data.new_password)
    save_config(config_manager.app_config)
    return {"message": "Password updated successfully."}

# --- WebSocket ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            try:
                data = await websocket.receive_text()
                request = json.loads(data)
                date_str = request.get('date')

                if date_str and config_manager.app_config.is_configured:
                    statuses = {}
                    for room in config_manager.app_config.rooms:
                        status = calendar_parser.get_room_status(room, date_str)
                        statuses[room.email] = status

                    await websocket.send_text(json.dumps({"date": date_str, "statuses": statuses}))
            except WebSocketDisconnect:
                raise  # Re-levanta para ser tratado pelo bloco externo
            except Exception as e:
                logging.error(f"Erro ao processar mensagem WebSocket: {e}", exc_info=True)
                # Envia uma mensagem de erro genérica para o cliente, se possível, ou apenas continua
                # Aqui optamos por continuar ouvindo, mas logando o erro.
                # Um pequeno sleep evita loops muito rápidos em caso de erro persistente na leitura
                await asyncio.sleep(1)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logging.info("WebSocket desconectado pelo cliente.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
