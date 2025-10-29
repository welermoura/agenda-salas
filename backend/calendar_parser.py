import arrow
from icalendar import Calendar
import requests
from datetime import timedelta
import subprocess

def get_room_status(url):
    """
    Busca e analisa um calendário .ics para determinar o status de uma sala de reunião.
    Retorna um dicionário com a programação horária do dia atual.
    """
    try:
        # Usa requests para buscar o calendário com um User-Agent comum
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status() # Lança uma exceção para códigos de status ruins (4xx ou 5xx)
        calendar_data = response.text
    except requests.exceptions.RequestException as e:
        # Se a requisição falhar, lança uma exceção clara
        raise ConnectionError(f"Falha ao buscar o calendário da URL: {url}. Erro: {e}") from e

    cal = Calendar.from_ical(calendar_data)

    now = arrow.now('America/Sao_Paulo')
    today_start = now.floor('day')
    today_end = now.ceil('day')

    # Gera slots de 30 minutos das 06:00 às 20:00
    schedule = {}
    start_time = today_start.replace(hour=6)
    end_time = today_start.replace(hour=20)
    current_slot = start_time
    while current_slot <= end_time:
        schedule[current_slot.strftime("%H:%M")] = "livre"
        current_slot = current_slot.shift(minutes=30)

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

            if start < today_end and end > today_start:
                # Itera sobre cada slot de 30 minutos do evento
                current_time = start
                while current_time < end:
                    # Arredonda para o slot de 30 minutos mais próximo (para baixo)
                    minute = 30 if current_time.minute >= 30 else 0
                    current_slot_time = current_time.replace(minute=minute, second=0, microsecond=0)

                    slot_str = current_slot_time.strftime("%H:%M")
                    if slot_str in schedule:
                        schedule[slot_str] = "ocupado"

                    # Avança para o próximo slot de 30 minutos
                    current_time = current_time.shift(minutes=30)

    return schedule
