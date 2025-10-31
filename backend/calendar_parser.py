import arrow
import msal
import requests
from datetime import timedelta

# Importa a instância do AppConfig e a classe Room do main
from main import app_config, Room

# --- Cache Simples em Memória ---
# Cache para tokens de acesso da API Graph para evitar requisições repetidas
token_cache = {
    "token": None,
    "expires_at": None
}

# Cache para os status das salas, para melhorar a performance de navegação de data
calendar_cache = {}
CACHE_TTL_MINUTES = 5

# --- Lógica de Autenticação com MSAL ---

def get_graph_access_token():
    """
    Obtém um token de acesso para a API do Microsoft Graph usando as credenciais
    configuradas na aplicação. Utiliza um cache em memória simples.
    """
    now = arrow.utcnow()

    # Verifica se há um token válido no cache
    if token_cache["token"] and token_cache["expires_at"] > now:
        return token_cache["token"]

    # Garante que a aplicação está configurada
    if not all([app_config.graph_tenant_id, app_config.graph_client_id, app_config.graph_client_secret]):
        print("Erro: A configuração da API Graph está incompleta.")
        return None

    authority = f"https://login.microsoftonline.com/{app_config.graph_tenant_id}"

    app = msal.ConfidentialClientApplication(
        client_id=app_config.graph_client_id,
        authority=authority,
        client_credential=app_config.graph_client_secret,
    )

    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])

    if "access_token" in result:
        # Armazena o novo token e sua data de expiração no cache
        token_cache["token"] = result['access_token']
        # Adiciona um buffer de 5 minutos para segurança
        token_cache["expires_at"] = now.shift(seconds=result.get('expires_in', 3600) - 300)
        return result['access_token']
    else:
        print("Erro ao adquirir token de acesso:", result.get("error_description"))
        return None

# --- Lógica de Consulta ao Calendário ---

def get_room_status(room: Room, date_str: str | None = None):
    """
    Busca os eventos de uma sala para uma data específica usando a API do Microsoft Graph
    e retorna o status (livre/ocupado) para cada intervalo de 30 minutos.
    """
    target_date = arrow.get(date_str) if date_str else arrow.now('America/Sao_Paulo')

    # Verifica o cache de calendários
    cache_key = (room.email, target_date.format('YYYY-MM-DD'))
    now_utc = arrow.utcnow()
    if cache_key in calendar_cache and \
       (now_utc - calendar_cache[cache_key]['timestamp']).total_seconds() < CACHE_TTL_MINUTES * 60:
        return calendar_cache[cache_key]['data']

    token = get_graph_access_token()
    if not token:
        return {"error": "Falha na autenticação com a API Graph."}

    # Define o início e o fim do dia na timezone correta para a consulta
    start_of_day = target_date.floor('day').to('utc').format('YYYY-MM-DDTHH:mm:ss') + "Z"
    end_of_day = target_date.ceil('day').to('utc').format('YYYY-MM-DDTHH:mm:ss') + "Z"

    # Endpoint da API Graph para visualizar o calendário
    url = f"https://graph.microsoft.com/v1.0/users/{room.email}/calendarView"

    headers = {
        'Authorization': f'Bearer {token}',
        'Prefer': f'outlook.timezone="America/Sao_Paulo"'
    }

    params = {
        'startDateTime': start_of_day,
        'endDateTime': end_of_day,
        '$select': 'subject,start,end'
    }

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        events = response.json().get('value', [])
    except requests.RequestException as e:
        print(f"Erro ao buscar eventos para {room.email}: {e}")
        return {"error": "Erro de comunicação com a API Graph."}

    # Inicializa o status de todos os horários como 'livre'
    schedule_start_hour = 8
    schedule_end_hour = 20
    time_slots = {}
    current_time = target_date.floor('day').replace(hour=schedule_start_hour)
    while current_time.hour < schedule_end_hour:
        time_slots[current_time.format('HH:mm')] = 'livre'
        current_time = current_time.shift(minutes=30)

    # Marca os horários ocupados com base nos eventos
    for event in events:
        start = arrow.get(event['start']['dateTime']).to('America/Sao_Paulo')
        end = arrow.get(event['end']['dateTime']).to('America/Sao_Paulo')

        # Arredonda o início para o intervalo de 30 minutos anterior mais próximo
        start_rounded = start.floor('minute').replace(minute=(start.minute // 30) * 30, second=0, microsecond=0)

        # Itera sobre os intervalos de 30 minutos que o evento ocupa
        current_slot_time = start_rounded
        while current_slot_time < end:
            slot_key = current_slot_time.format('HH:mm')
            if slot_key in time_slots:
                time_slots[slot_key] = 'ocupado'
            current_slot_time = current_slot_time.shift(minutes=30)

    result = {"nome": room.name, "status": time_slots}

    # Armazena o resultado no cache
    calendar_cache[cache_key] = {'timestamp': now_utc, 'data': result}

    return result
