import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import uvicorn

# --- Novos imports para segurança e configuração ---
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
import secrets

# Importa a nova lógica do calendar_parser
import calendar_parser

# --- Estrutura de Dados ---

class Room(BaseModel):
    email: str
    name: str

class AppConfig(BaseModel):
    is_configured: bool = False
    admin_password_hash: str | None = None
    graph_tenant_id: str | None = None
    graph_client_id: str | None = None
    graph_client_secret: str | None = None
    rooms: list[Room] = []

# --- Gerenciamento de Configuração ---
CONFIG_FILE = "config.json"
app_config = AppConfig()

def load_config():
    global app_config
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            config_data = json.load(f)
            app_config = AppConfig(**config_data)
    else:
        save_config()

def save_config():
    with open(CONFIG_FILE, "w") as f:
        json.dump(app_config.model_dump(), f, indent=4)

# --- Segurança e Autenticação ---
SECRET_KEY = secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

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
        if app_config.is_configured and app_config.rooms:
            today_str = datetime.now().strftime('%Y-%m-%d')
            statuses = {}
            for room in app_config.rooms:
                status = calendar_parser.get_room_status(room, today_str)
                statuses[room.email] = status

            await manager.broadcast(json.dumps({"date": today_str, "statuses": statuses}))

        await asyncio.sleep(10) # Intervalo de atualização


# --- Ciclo de Vida da Aplicação ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_config()
    if app_config.is_configured:
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
    return {"is_configured": app_config.is_configured}

@app.post("/api/setup/initialize")
async def initialize_setup(data: SetupData):
    if app_config.is_configured:
        raise HTTPException(status_code=403, detail="Application is already configured.")

    app_config.admin_password_hash = get_password_hash(data.admin_password)
    app_config.graph_tenant_id = data.tenant_id
    app_config.graph_client_id = data.client_id
    app_config.graph_client_secret = data.client_secret
    app_config.is_configured = True
    save_config()

    # Inicia o scheduler após a configuração
    loop = asyncio.get_event_loop()
    loop.create_task(update_scheduler())

    return {"message": "Setup complete. Please log in."}

# --- Endpoints de Autenticação e Admin ---
@app.post("/api/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    if not app_config.is_configured or not verify_password(form_data.password, app_config.admin_password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
    access_token = create_access_token(data={"sub": form_data.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/rooms", response_model=list[Room])
async def get_rooms(current_user: str = Depends(get_current_user)):
    return app_config.rooms

@app.post("/api/rooms")
async def update_rooms(rooms: list[Room], current_user: str = Depends(get_current_user)):
    app_config.rooms = rooms
    save_config()
    return {"message": "Rooms updated successfully."}

class GraphConfig(BaseModel):
    tenant_id: str
    client_id: str

@app.get("/api/config", response_model=GraphConfig)
async def get_graph_config(current_user: str = Depends(get_current_user)):
    return GraphConfig(tenant_id=app_config.graph_tenant_id, client_id=app_config.graph_client_id)

@app.post("/api/config")
async def update_graph_config(config: GraphConfig, current_user: str = Depends(get_current_user)):
    app_config.graph_tenant_id = config.tenant_id
    app_config.graph_client_id = config.client_id
    save_config()
    return {"message": "Graph configuration updated successfully."}

class PasswordChange(BaseModel):
    new_password: str

@app.post("/api/change-password")
async def change_password(password_data: PasswordChange, current_user: str = Depends(get_current_user)):
    app_config.admin_password_hash = get_password_hash(password_data.new_password)
    save_config()
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
            data = await websocket.receive_text()
            request = json.loads(data)
            date_str = request.get('date')

            if date_str and app_config.is_configured:
                statuses = {}
                for room in app_config.rooms:
                    status = calendar_parser.get_room_status(room, date_str)
                    statuses[room.email] = status

                await websocket.send_text(json.dumps({"date": date_str, "statuses": statuses}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
