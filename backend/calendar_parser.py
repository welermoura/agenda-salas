import arrow
from icalendar import Calendar
import requests
from datetime import timedelta
import time

# --- Cache em Memória com TTL (Time-To-Live) ---
_cache = {}
CACHE_EXPIRATION_SECONDS = 300  # 5 minutos

def _get_from_cache(key):
    """Obtém um item do cache se ele existir e não tiver expirado."""
    if key in _cache:
        entry = _cache[key]
        if time.time() - entry['timestamp'] < CACHE_EXPIRATION_SECONDS:
            return entry['data']
    return None

def _set_in_cache(key, data):
    """Define um item no cache com o timestamp atual."""
    _cache[key] = {
        'data': data,
        'timestamp': time.time()
    }
# --- Fim da Implementação do Cache ---


def get_room_status(url, date_str=None):
    """
    Busca e analisa um calendário .ics para determinar o status de uma sala de reunião.
    Retorna um dicionário com a programação horária do dia especificado.
    Utiliza um cache em memória para otimizar requisições repetidas.
    """
    # Define a data alvo para usar na chave do cache de forma consistente
    target_date_key = date_str if date_str else arrow.now('America/Sao_Paulo').format('YYYY-MM-DD')
    cache_key = (url, target_date_key)

    # Tenta obter do cache primeiro
    cached_schedule = _get_from_cache(cache_key)
    if cached_schedule is not None:
        return cached_schedule

    # --- Se não estiver no cache, executa a lógica original ---
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        calendar_data = response.text
    except requests.exceptions.RequestException as e:
        raise ConnectionError(f"Falha ao buscar o calendário da URL: {url}. Erro: {e}") from e

    cal = Calendar.from_ical(calendar_data)

    if date_str:
        target_date = arrow.get(date_str, 'YYYY-MM-DD', tzinfo='America/Sao_Paulo')
    else:
        target_date = arrow.now('America/Sao_Paulo')

    day_start = target_date.floor('day')
    day_end = target_date.ceil('day')

    # Gera o schedule com intervalos de 30 minutos
    schedule = {}
    current_schedule_time = day_start.replace(hour=8, minute=0)
    while current_schedule_time.hour < 21:
        schedule[current_schedule_time.strftime("%H:%M")] = "livre"
        current_schedule_time += timedelta(minutes=30)


    for component in cal.walk():
        if component.name == "VEVENT":
            dtstart = component.get('dtstart').dt
            dtend = component.get('dtend').dt

            # Converte para arrow e ajusta o fuso horário se não houver
            try:
                start = arrow.get(dtstart).to('America/Sao_Paulo')
                end = arrow.get(dtend).to('America/Sao_Paulo')
            except arrow.parser.ParserError:
                # Se houver erro de parsing, tenta adicionar fuso horário
                start = arrow.get(dtstart.strftime('%Y-%m-%d %H:%M:%S')).replace(tzinfo='America/Sao_Paulo')
                end = arrow.get(dtend.strftime('%Y-%m-%d %H:%M:%S')).replace(tzinfo='America/Sao_Paulo')

            if start < day_end and end > day_start:
                # Arredonda a hora de início para o intervalo de 30 minutos anterior mais próximo
                start_minute = 0 if start.minute < 30 else 30
                current_time = start.replace(minute=start_minute, second=0, microsecond=0)

                # Itera sobre cada intervalo de 30 minutos até o final do evento
                while current_time < end:
                    time_str = current_time.strftime("%H:%M")
                    if time_str in schedule:
                        schedule[time_str] = "ocupado"
                    current_time += timedelta(minutes=30)

    # Armazena o resultado no cache antes de retornar
    _set_in_cache(cache_key, schedule)
    return schedule
