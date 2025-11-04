import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime
import secrets
import logging
import uvicorn

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- Segurança e Autenticação ---
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext

# Importa a lógica de configuração e os modelos partilhados
from config_manager import app_config, Room, load_config, save_config
import calendar_parser

# --- Variáveis Globais de Segurança (a serem inicializadas) ---
SECRET_KEY = None
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def configure_security():
    """Define a chave secreta JWT, gerando-a e guardando-a na primeira execução."""
    global SECRET_KEY
    if not app_config.jwt_secret_key:
        app_config.jwt_secret_key = secrets.token_urlsafe(32)
        save_config()
    SECRET_KEY = app_config.jwt_secret_key

# --- Funções de Segurança ---
def verify_password(plain_password, hashed_password):
    password_bytes = plain_password.encode('utf-8')
    truncated_password = password_bytes[:72]
    return pwd_context.verify(truncated_password, hashed_password)

def get_password_hash(password):
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
async def update_scheduler(manager):
    while True:
        try:
            if app_config.is_configured and app_config.rooms:
                today_str = datetime.now().strftime('%Y-%m-%d')
                statuses = {}
                for room in app_config.rooms:
                    status = calendar_parser.get_room_status(room, today_str)
                    statuses[room.email] = status
                await manager.broadcast(json.dumps({"date": today_str, "statuses": statuses}))
            await asyncio.sleep(10) # Intervalo de atualização
        except Exception as e:
            logging.error(f"Erro no scheduler de atualização: {e}", exc_info=True)
            await asyncio.sleep(60)

# --- Gestor de WebSocket ---
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

def create_app() -> FastAPI:
    # 1. Configurar o logging PRIMEIRO
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    # 2. Carregar a configuração de forma explícita
    load_config()

    # 3. Configurar a segurança (chave JWT)
    configure_security()

    # 4. Definir o ciclo de vida da aplicação
    manager = ConnectionManager()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if app_config.is_configured:
            loop = asyncio.get_event_loop()
            task = loop.create_task(update_scheduler(manager))
            logging.info("Scheduler de atualização iniciado.")
        yield
        if 'task' in locals() and not task.done():
            task.cancel()
            logging.info("Scheduler de atualização parado.")

    # 5. Criar a instância da aplicação FastAPI
    app = FastAPI(lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Endpoints ---
    @app.get("/api/setup/status")
    async def get_setup_status():
        return {"is_configured": app_config.is_configured}

    class SetupData(BaseModel):
        admin_password: str
        tenant_id: str
        client_id: str
        client_secret: str

    @app.post("/api/setup/initialize")
    async def initialize_setup(data: SetupData):
        if app_config.is_configured:
            raise HTTPException(status_code=403, detail="Application is already configured.")

        app_config.admin_password_hash = get_password_hash(data.admin_password)
        app_config.graph_tenant_id = data.tenant_id
        app_config.graph_client_id = data.client_id
        app_config.graph_client_secret = data.client_secret
        app_config.is_configured = True
        # A chave secreta será gerada e guardada pela função `configure_security` no próximo arranque,
        # mas podemos forçar a sua criação agora.
        if not app_config.jwt_secret_key:
            app_config.jwt_secret_key = secrets.token_urlsafe(32)

        save_config()
        # Reinicia a segurança para usar a nova chave imediatamente
        global SECRET_KEY
        SECRET_KEY = app_config.jwt_secret_key

        return {"message": "Setup complete. Please log in."}

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
        except Exception as e:
            logging.error(f"Erro no WebSocket: {e}", exc_info=True)
            manager.disconnect(websocket)

    return app

# --- Ponto de Entrada Principal ---
app = create_app()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
