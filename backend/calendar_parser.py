import requests
from ics import Calendar
from datetime import datetime
import arrow

def get_room_status(url: str) -> str:
    try:
        response = requests.get(url)
        response.raise_for_status()

        calendar = Calendar(response.text)
        now = arrow.utcnow()

        for event in calendar.events:
            if event.begin < now < event.end:
                return "ocupado"

        return "livre"

    except Exception as e:
        print(f"Erro ao processar o calendário da URL {url}: {e}")
        return "desconhecido"
