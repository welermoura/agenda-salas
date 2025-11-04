import arrow
import msal
import requests
import json
from datetime import timedelta

# Importa a configuração e os modelos partilhados do novo módulo
from config_manager import app_config, Room

# --- Caches em Memória ---
token_cache = {
    "token": None,
    "expires_at": None
}
# Cache para os status das salas, para melhorar a performance de navegação de data
calendar_cache = {}
CACHE_TTL_SECONDS = 2

# Novo cache para mapear e-mails para IDs de objeto imutáveis
user_id_cache = {}

# --- Lógica de Autenticação com MSAL ---

def get_graph_access_token():
    """Obtém um token de acesso para a API do Microsoft Graph."""
    now = arrow.utcnow()

    if token_cache["token"] and token_cache["expires_at"] > now:
        return token_cache["token"]

    if not all([app_config.graph_tenant_id, app_config.graph_client_id, app_config.graph_client_secret]):
        print("Erro: A configuração da API Graph está incompleta.")
        return None

    authority = f"https://login.microsoftonline.com/{app_config.graph_tenant_id}"

    try:
        app = msal.ConfidentialClientApplication(
            client_id=app_config.graph_client_id,
            authority=authority,
            client_credential=app_config.graph_client_secret,
        )
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    except ValueError as e:
        print(f"Erro de configuração da autoridade MSAL: {e}")
        return None

    if "access_token" in result:
        token_cache["token"] = result['access_token']
        token_cache["expires_at"] = now.shift(seconds=result.get('expires_in', 3600) - 300)
        return result['access_token']
    else:
        print("Erro ao adquirir token de acesso:", result.get("error_description"))
        return None

# --- Lógica de Consulta ao Calendário ---

def get_room_user_id(room_email: str, headers: dict):
    """Obtém o ID de objeto imutável de um utilizador/recurso a partir do seu e-mail."""
    if room_email in user_id_cache:
        return user_id_cache[room_email]

    url = f"https://graph.microsoft.com/v1.0/users/{room_email}?$select=id"
    response = requests.get(url, headers=headers)
    response.raise_for_status() # Lança exceção para erros HTTP
    user_id = response.json().get('id')
    if user_id:
        user_id_cache[room_email] = user_id
    return user_id


def get_room_status(room: Room, date_str: str | None = None):
    """Busca os eventos de uma sala para uma data específica."""
    target_date = arrow.get(date_str) if date_str else arrow.now('America/Sao_Paulo')

    cache_key = (room.email, target_date.format('YYYY-MM-DD'))
    now_utc = arrow.utcnow()
    if cache_key in calendar_cache and \
       (now_utc - calendar_cache[cache_key]['timestamp']).total_seconds() < CACHE_TTL_SECONDS:
        return calendar_cache[cache_key]['data']

    token = get_graph_access_token()
    if not token:
        return {"error": "Falha na autenticação. Verifique as credenciais, o Tenant ID e a conectividade de rede do servidor."}

    headers = {
        'Authorization': f'Bearer {token}'
    }

    try:
        # PASSO 1: Obter o ID do utilizador/recurso
        user_id = get_room_user_id(room.email, headers)
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

        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        events = response.json().get('value', [])

    except requests.exceptions.ConnectionError as e:
        error_message = "Falha de Rede: Não foi possível conectar à API Graph. Verifique a firewall e o DNS do servidor."
        print(f"Erro de conexão para {room.email}: {e}")
        return {"error": error_message}
    except requests.RequestException as e:
        error_message = "Erro na resposta da API Graph."
        if e.response is not None:
            try:
                error_details = e.response.json()
                msg = error_details.get("error", {}).get("message", "N/A")
                error_message = f"Erro da API ({e.response.status_code}): {msg}"
            except json.JSONDecodeError:
                error_message = f"Erro da API ({e.response.status_code}): Resposta inválida."

        print(f"Erro ao buscar eventos para {room.email}: {error_message}")
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
    for event in events:
        # Corrige o parsing de data para usar o timezone fornecido pela API
        start_tz = event['start'].get('timeZone', 'UTC')
        end_tz = event['end'].get('timeZone', 'UTC')

        start = arrow.get(event['start']['dateTime'], tzinfo=start_tz).to('America/Sao_Paulo')
        end = arrow.get(event['end']['dateTime'], tzinfo=end_tz).to('America/Sao_Paulo')

        start_rounded = start.floor('minute').replace(minute=(start.minute // 30) * 30, second=0, microsecond=0)

        current_slot_time = start_rounded
        while current_slot_time < end:
            slot_key = current_slot_time.format('HH:mm')
            if slot_key in time_slots:
                time_slots[slot_key] = 'ocupado'
            current_slot_time = current_slot_time.shift(minutes=30)

    result = {"nome": room.name, "status": time_slots}

    calendar_cache[cache_key] = {'timestamp': now_utc, 'data': result}

    return result
