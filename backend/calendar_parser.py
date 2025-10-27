import requests
from ics import Calendar
import arrow
from typing import List, Dict

def get_room_schedule_for_today(url: str) -> List[Dict[str, str]]:
    """
    Busca um calendário de uma URL e retorna uma lista de eventos para o dia atual.
    Cada evento é um dicionário com chaves 'start' e 'end' no formato ISO.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()

        calendar = Calendar(response.text)
        today = arrow.utcnow()
        today_start = today.floor('day')
        today_end = today.ceil('day')

        events_today = []
        for event in calendar.events:
            # Verifica se o evento se sobrepõe com o dia de hoje
            if event.begin <= today_end and event.end >= today_start:
                events_today.append({
                    "start": event.begin.isoformat(),
                    "end": event.end.isoformat(),
                })

        return events_today

    except Exception as e:
        print(f"Erro ao processar o calendário da URL {url}: {e}")
        return []
