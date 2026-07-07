import arrow
import msal
import httpx
import asyncio
import json
import logging
import os
import tempfile
from datetime import timedelta

# --- Função Auxiliar de Requisições Assíncronas com Retentativas (Retry Logic) ---

async def graph_request_with_retry_async(client: httpx.AsyncClient, method: str, url: str, headers: dict, params=None, timeout=10, max_retries=3):
    backoff = 1
    for attempt in range(max_retries):
        try:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params, timeout=timeout)
            else:
                response = await client.post(url, headers=headers, json=params, timeout=timeout)

            if response.status_code in (429, 503):
                retry_after = response.headers.get("Retry-After")
                try:
                    sleep_time = int(retry_after) if retry_after else (backoff * 2)
                except ValueError:
                    sleep_time = backoff * 2
                logging.warning(f"API Graph retornou status {response.status_code}. Retentando em {sleep_time}s (Tentativa {attempt + 1}/{max_retries})")
                await asyncio.sleep(sleep_time)
                backoff *= 2
                continue

            return response
        except httpx.RequestError as e:
            if attempt == max_retries - 1:
                raise
            sleep_time = backoff * 2
            logging.warning(f"Erro de conexão na API Graph: {e}. Retentando em {sleep_time}s (Tentativa {attempt + 1}/{max_retries})")
            await asyncio.sleep(sleep_time)
            backoff *= 2

# Importa a configuração e os modelos partilhados do novo módulo
import config_manager
from config_manager import Room

# --- Caches em Memória e Físico ---
token_cache = {
    "token": None,
    "expires_at": None
}
calendar_cache = {}
CACHE_TTL_SECONDS = 300  # Aumentamos o cache padrão para 5 minutos para economizar chamadas
CACHE_FILE = "/app/data/calendar_cache.json"

def load_cache():
    global calendar_cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                data = json.load(f)
            for k, v in data.items():
                email, date_str = k.split("|")
                calendar_cache[(email, date_str)] = {
                    "timestamp": arrow.get(v["timestamp"]),
                    "data": v["data"]
                }
            logging.info("Cache de calendário carregado com sucesso do disco.")
        except Exception as e:
            logging.error(f"Erro ao carregar cache de calendário do disco: {e}")

def save_cache_to_disk():
    try:
        data = {}
        for (email, date_str), v in calendar_cache.items():
            now_utc = arrow.utcnow()
            if (now_utc - v["timestamp"]).total_seconds() < CACHE_TTL_SECONDS:
                data[f"{email}|{date_str}"] = {
                    "timestamp": v["timestamp"].isoformat(),
                    "data": v["data"]
                }
        dir_name = os.path.dirname(CACHE_FILE)
        os.makedirs(dir_name, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False, prefix="cache_", suffix=".json") as f:
            temp_path = f.name
            json.dump(data, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_path, CACHE_FILE)
    except Exception as e:
        logging.error(f"Erro ao salvar cache de calendário no disco: {e}")

# Carrega o cache ao iniciar o módulo
load_cache()

def clear_calendar_cache(email: str = None):
    """Limpa o cache do calendário. Se email for fornecido, limpa apenas daquela sala."""
    if email:
        keys_to_remove = [k for k in calendar_cache.keys() if k[0] == email]
        for k in keys_to_remove:
            calendar_cache.pop(k, None)
    else:
        calendar_cache.clear()
    save_cache_to_disk()

# Novo cache para mapear e-mails para IDs de objeto imutáveis
user_id_cache = {}

# --- Lógica de Autenticação com MSAL ---

def get_graph_access_token(force_refresh=False):
    """Obtém um token de acesso para a API do Microsoft Graph."""
    now = arrow.utcnow()

    if not force_refresh and token_cache["token"] and token_cache["expires_at"] > now:
        return token_cache["token"]

    if not all([config_manager.app_config.graph_tenant_id, config_manager.app_config.graph_client_id, config_manager.app_config.graph_client_secret]):
        logging.error("Erro: A configuração da API Graph está incompleta.")
        return None

    authority = f"https://login.microsoftonline.com/{config_manager.app_config.graph_tenant_id}"
    logging.info(f"A adquirir novo token Graph. Force refresh: {force_refresh}")

    try:
        app = msal.ConfidentialClientApplication(
            client_id=config_manager.app_config.graph_client_id,
            authority=authority,
            client_credential=config_manager.app_config.graph_client_secret,
        )
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    except Exception as e:
        logging.error(f"Erro de configuração ou de rede ao adquirir token MSAL: {e}", exc_info=True)
        return None

    if "access_token" in result:
        token_cache["token"] = result['access_token']
        # Define expiração com margem de segurança de 5 minutos
        expires_in = result.get('expires_in', 3600)
        token_cache["expires_at"] = now.shift(seconds=expires_in - 300)
        logging.info(f"Token Graph adquirido com sucesso. Expira em {expires_in} segundos.")
        return result['access_token']
    else:
        logging.error(f"Erro ao adquirir token de acesso: {result.get('error_description')}")
        return None

# --- Lógica de Consulta ao Calendário ---

async def get_room_user_id_async(client: httpx.AsyncClient, room_email: str, headers: dict):
    """Obtém o ID de objeto imutável de um utilizador/recurso a partir do seu e-mail de forma assíncrona."""
    if room_email in user_id_cache:
        return user_id_cache[room_email]

    url = f"https://graph.microsoft.com/v1.0/users/{room_email}?$select=id"
    response = await graph_request_with_retry_async(client, "GET", url, headers=headers, timeout=10)
    response.raise_for_status() # Lança exceção para erros HTTP
    user_id = response.json().get('id')
    if user_id:
        user_id_cache[room_email] = user_id
    return user_id


async def get_room_status_async(room: Room, date_str: str | None = None):
    """Busca os eventos de uma sala para uma data específica de forma assíncrona."""
    target_date = arrow.get(date_str) if date_str else arrow.now('America/Sao_Paulo')

    cache_key = (room.email, target_date.format('YYYY-MM-DD'))
    now_utc = arrow.utcnow()
    if cache_key in calendar_cache and \
       (now_utc - calendar_cache[cache_key]['timestamp']).total_seconds() < CACHE_TTL_SECONDS:
        return calendar_cache[cache_key]['data']

    token = await asyncio.to_thread(get_graph_access_token)
    if not token:
        return {"error": "Falha na autenticação. Verifique as credenciais, o Tenant ID e a conectividade de rede do servidor."}

    headers = {
        'Authorization': f'Bearer {token}',
        'Prefer': 'outlook.timezone="America/Sao_Paulo"'
    }

    async with httpx.AsyncClient() as client:
        try:
            # PASSO 1: Obter o ID do utilizador/recurso de forma assíncrona
            user_id = await get_room_user_id_async(client, room.email, headers)
            if not user_id:
                return {"error": f"Não foi possível encontrar o ID para o e-mail: {room.email}"}

            # PASSO 2: Usar o ID para obter o calendarView
            start_of_day = target_date.floor('day').to('utc').format('YYYY-MM-DDTHH:mm:ss') + "Z"
            end_of_day = target_date.ceil('day').to('utc').format('YYYY-MM-DDTHH:mm:ss') + "Z"

            url = f"https://graph.microsoft.com/v1.0/users/{user_id}/calendarView"
            params = {
                'startDateTime': start_of_day,
                'endDateTime': end_of_day,
                '$select': 'subject,start,end'
            }

            response = await graph_request_with_retry_async(client, "GET", url, headers=headers, params=params, timeout=10)
            response.raise_for_status()
            events = response.json().get('value', [])

        except httpx.HTTPStatusError as e:
            # Lógica de Retry para Token Expirado (401)
            if e.response is not None and e.response.status_code == 401:
                logging.warning(f"Token expirado (401) detectado para {room.email}. Tentando renovar e repetir a operação.")
                new_token = await asyncio.to_thread(get_graph_access_token, force_refresh=True)
                if new_token:
                    headers['Authorization'] = f'Bearer {new_token}'
                    try:
                        user_id = await get_room_user_id_async(client, room.email, headers)
                        url = f"https://graph.microsoft.com/v1.0/users/{user_id}/calendarView"
                        response = await graph_request_with_retry_async(client, "GET", url, headers=headers, params=params, timeout=10)
                        response.raise_for_status()
                        events = response.json().get('value', [])
                    except Exception as retry_exc:
                        logging.error(f"Falha na tentativa de retry após 401: {retry_exc}")
                        return {"error": "Falha na autenticação após renovação do token."}
                else:
                     return {"error": "Sessão expirada. Não foi possível renovar o token de acesso."}
            else:
                error_message = "Erro na resposta da API Graph."
                if e.response is not None:
                    try:
                        error_details = e.response.json()
                        msg = error_details.get("error", {}).get("message", "N/A")
                        error_message = f"Erro da API ({e.response.status_code}): {msg}"
                    except json.JSONDecodeError:
                        error_message = f"Erro da API ({e.response.status_code}): Resposta inválida."

                logging.error(f"Erro ao buscar eventos para {room.email}: {error_message}")
                return {"error": error_message}
        except httpx.RequestError as e:
            error_message = "Falha de Rede: Não foi possível conectar à API Graph. Verifique a firewall e o DNS do servidor."
            logging.error(f"Erro de conexão para {room.email}: {e}")
            return {"error": error_message}

    # --- Lógica de Geração de Horários ---
    time_slots = {}
    schedule_start = target_date.floor('day').replace(hour=8, minute=0)
    schedule_end = target_date.floor('day').replace(hour=19, minute=30)
    current_time = schedule_start

    while current_time <= schedule_end:
        time_slots[current_time.format('HH:mm')] = 'livre'
        current_time = current_time.shift(minutes=30)

    # Marca os horários ocupados com base nos eventos
    try:
        for event in events:
            start = arrow.get(event['start']['dateTime'])
            end = arrow.get(event['end']['dateTime'])

            start_rounded = start.floor('minute').replace(minute=(start.minute // 30) * 30, second=0, microsecond=0)

            current_slot_time = start_rounded
            while current_slot_time < end:
                slot_key = current_slot_time.format('HH:mm')
                if slot_key in time_slots:
                    time_slots[slot_key] = 'ocupado'
                current_slot_time = current_slot_time.shift(minutes=30)

        result = {"nome": room.name, "logo_version": room.logo_version, "tooltip": room.tooltip, "status": time_slots}
        calendar_cache[cache_key] = {'timestamp': now_utc, 'data': result}
        save_cache_to_disk()
        return result

    except Exception as e:
        import traceback
        error_msg = f"Erro ao processar eventos para {room.email}: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        return {"error": error_msg}
