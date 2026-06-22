import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import secrets
from collections import defaultdict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, UploadFile, File, Request, Cookie, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

# --- Limitador de tentativas de login (Rate Limiter em Memória) ---
login_attempts = defaultdict(lambda: {"failed_attempts": 0, "lockout_until": None})
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)

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
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(
    request: Request,
    token: str | None = Cookie(default=None, alias="access_token")
):
    if not token:
        authorization: str = request.headers.get("Authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

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
                rooms = config_manager.app_config.rooms
                tasks = [calendar_parser.get_room_status_async(room, today_str) for room in rooms]
                results = await asyncio.gather(*tasks)
                for room, status in zip(rooms, results):
                    status_copy = status.copy() if isinstance(status, dict) else {}
                    status_copy["nome"] = room.name
                    status_copy["logo_version"] = room.logo_version
                    status_copy["tooltip"] = room.tooltip
                    statuses[room.email] = status_copy

                await manager.broadcast(json.dumps({"date": today_str, "statuses": statuses}))

            await asyncio.sleep(5)
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
async def login_for_access_token(response: Response, request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    client_ip = request.client.host if request.client else "unknown"
    
    # Verifica se o IP está atualmente bloqueado
    ip_data = login_attempts[client_ip]
    now = datetime.now(timezone.utc)
    
    if ip_data["lockout_until"]:
        # Se lockout_until for offset-naive, converte para offset-aware
        lockout_time = ip_data["lockout_until"]
        if lockout_time.tzinfo is None:
            lockout_time = lockout_time.replace(tzinfo=timezone.utc)
            
        if now < lockout_time:
            time_left = int((lockout_time - now).total_seconds())
            raise HTTPException(
                status_code=429, 
                detail=f"Muitas tentativas incorretas. IP bloqueado por mais {time_left} segundos."
            )
        else:
            # Tempo de bloqueio expirou, reseta o lockout
            ip_data["lockout_until"] = None
            ip_data["failed_attempts"] = 0

    if not config_manager.app_config.is_configured or not verify_password(form_data.password, config_manager.app_config.admin_password_hash):
        # Incrementa tentativas incorretas
        ip_data["failed_attempts"] += 1
        if ip_data["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
            ip_data["lockout_until"] = now + LOCKOUT_DURATION
            raise HTTPException(
                status_code=429, 
                detail="Muitas tentativas incorretas. Este IP foi bloqueado por 15 minutos."
            )
        raise HTTPException(
            status_code=401, 
            detail=f"Usuário ou senha incorretos. Tentativa {ip_data['failed_attempts']}/{MAX_FAILED_ATTEMPTS}.",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    # Se o login for bem-sucedido, reseta as tentativas para este IP
    if client_ip in login_attempts:
        del login_attempts[client_ip]
        
    access_token = create_access_token(data={"sub": form_data.username})
    
    # Set the HTTPOnly session cookie (SameSite=Lax for secure cross-origin safety within domain)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False  # Set to False to support HTTP accesses on 10.10.1.220 / local dev
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully."}

@app.get("/api/rooms", response_model=list[Room])
async def get_rooms(current_user: str = Depends(get_current_user)):
    return config_manager.app_config.rooms

@app.post("/api/rooms")
async def update_rooms(rooms: list[Room], current_user: str = Depends(get_current_user)):
    config_manager.app_config.rooms = rooms
    save_config(config_manager.app_config)
    calendar_parser.clear_calendar_cache()
    return {"message": "Rooms updated successfully."}

@app.post("/api/rooms/{email}/logo")
async def upload_room_logo(email: str, file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    import os
    room_found = None
    for room in config_manager.app_config.rooms:
        if room.email == email:
            room_found = room
            break
            
    if not room_found:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")

    logos_dir = os.path.join(config_manager.DATA_DIR, "logos")
    os.makedirs(logos_dir, exist_ok=True)

    ext = file.filename.split('.')[-1].lower()
    if ext not in ('png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'):
        raise HTTPException(status_code=400, detail="Formato de arquivo não suportado.")

    file_path = os.path.join(logos_dir, f"{email}.png")
    try:
        content = await file.read()
        from PIL import Image
        import io
        try:
            image = Image.open(io.BytesIO(content))
            # Preserva transparência se o formato original suportar, caso contrário converte para RGB
            if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
                image = image.convert("RGBA")
            else:
                image = image.convert("RGB")
            # Salva como PNG otimizado
            image.save(file_path, "PNG", optimize=True)
        except Exception as img_err:
            logging.error(f"Erro ao converter imagem com Pillow para {email}: {img_err}", exc_info=True)
            with open(file_path, "wb") as f:
                f.write(content)
    except Exception as e:
        logging.error(f"Erro ao salvar logo da sala {email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Falha ao gravar arquivo de imagem.")

    room_found.logo_version += 1
    save_config(config_manager.app_config)
    calendar_parser.clear_calendar_cache(email)
    
    return {"message": "Logo enviado com sucesso.", "logo_version": room_found.logo_version}

@app.delete("/api/rooms/{email}/logo")
async def delete_room_logo(email: str, current_user: str = Depends(get_current_user)):
    import os
    room_found = None
    for room in config_manager.app_config.rooms:
        if room.email == email:
            room_found = room
            break
            
    if not room_found:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")

    file_path = os.path.join(config_manager.DATA_DIR, "logos", f"{email}.png")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logging.error(f"Erro ao remover arquivo de logo para {email}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Falha ao deletar arquivo de imagem.")

    room_found.logo_version = 0
    save_config(config_manager.app_config)
    calendar_parser.clear_calendar_cache(email)
    
    return {"message": "Logo removido com sucesso."}

@app.get("/api/rooms/{email}/logo")
async def get_room_logo(email: str):
    import os
    file_path = os.path.join(config_manager.DATA_DIR, "logos", f"{email}.png")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Logo não encontrado.")
    
    # Detecta o tipo de mídia real a partir dos cabeçalhos do arquivo
    media_type = "image/png"
    try:
        with open(file_path, "rb") as f:
            header = f.read(12)
            if header.startswith(b"\x89PNG\r\n\x1a\n"):
                media_type = "image/png"
            elif header.startswith(b"\xff\xd8\xff"):
                media_type = "image/jpeg"
            elif header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
                media_type = "image/gif"
            elif header.startswith(b"RIFF") and b"WEBP" in header[8:12]:
                media_type = "image/webp"
            elif b"<svg" in header.lower() or header.startswith(b"<?xml"):
                media_type = "image/svg+xml"
    except Exception:
        pass

    return FileResponse(file_path, media_type=media_type)

class GraphConfig(BaseModel):
    tenant_id: str
    client_id: str
    client_secret: str | None = None
    selected_theme: str | None = None

@app.get("/api/config", response_model=GraphConfig)
async def get_graph_config(current_user: str = Depends(get_current_user)):
    # Retorna a configuração SEM o client_secret por segurança
    return GraphConfig(
        tenant_id=config_manager.app_config.graph_tenant_id or "",
        client_id=config_manager.app_config.graph_client_id or "",
        selected_theme=config_manager.app_config.selected_theme
    )

@app.post("/api/config")
async def update_graph_config(config: GraphConfig, current_user: str = Depends(get_current_user)):
    config_manager.app_config.graph_tenant_id = config.tenant_id
    config_manager.app_config.graph_client_id = config.client_id
    if config.selected_theme:
        config_manager.app_config.selected_theme = config.selected_theme
    # Atualiza o segredo apenas se um novo valor não-vazio for fornecido
    if config.client_secret:
        config_manager.app_config.graph_client_secret = config.client_secret
    save_config(config_manager.app_config)
    calendar_parser.clear_calendar_cache()
    return {"message": "Configuration updated successfully."}

class PasswordChange(BaseModel):
    new_password: str

@app.post("/api/change-password")
async def change_password(password_data: PasswordChange, current_user: str = Depends(get_current_user)):
    config_manager.app_config.admin_password_hash = get_password_hash(password_data.new_password)
    save_config(config_manager.app_config)
    return {"message": "Password updated successfully."}

@app.get("/api/verify")
async def verify_token(current_user: str = Depends(get_current_user)):
    return {"status": "valid", "username": current_user}

@app.get("/api/diagnostics")
async def get_diagnostics(current_user: str = Depends(get_current_user)):
    import requests
    token = calendar_parser.get_graph_access_token()
    if not token:
        return {
            "status": "error",
            "message": "Falha ao obter token da API Graph. Verifique as credenciais do Azure AD."
        }
    
    headers = {'Authorization': f'Bearer {token}'}
    try:
        response = await asyncio.to_thread(
            requests.get,
            "https://graph.microsoft.com/v1.0/organization",
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            return {
                "status": "ok",
                "message": "Conexão com a API Graph estabelecida com sucesso."
            }
        else:
            try:
                error_details = response.json()
                msg = error_details.get("error", {}).get("message", "N/A")
            except Exception:
                msg = "Erro desconhecido"
            return {
                "status": "error",
                "message": f"Erro da API Graph (Status {response.status_code}): {msg}"
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Erro ao conectar com a API Graph: {str(e)}"
        }

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
                    rooms = config_manager.app_config.rooms
                    tasks = [calendar_parser.get_room_status_async(room, date_str) for room in rooms]
                    results = await asyncio.gather(*tasks)
                    for room, status in zip(rooms, results):
                        status_copy = status.copy() if isinstance(status, dict) else {}
                        status_copy["nome"] = room.name
                        status_copy["logo_version"] = room.logo_version
                        status_copy["tooltip"] = room.tooltip
                        statuses[room.email] = status_copy

                    await websocket.send_text(json.dumps({
                        "date": date_str, 
                        "statuses": statuses,
                        "theme": config_manager.app_config.selected_theme
                    }))
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
