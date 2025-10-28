import requests
from ics import Calendar
from datetime import datetime, time, timedelta
import arrow
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_room_status(url: str) -> dict:
    """
    Verifica o status de uma sala para cada hora do dia (06:00 - 20:00),
    usando um método robusto para tratar eventos de dia inteiro.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        }

        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()
        calendar = Calendar(response.text)

        today_utc = arrow.utcnow().to('utc').floor('day')
        horas = [time(h) for h in range(6, 21)]

        schedule_status = {}

        for hora in horas:
            start_time = today_utc.replace(hour=hora.hour, minute=hora.minute).datetime
            end_time = start_time + timedelta(hours=1)

            events_in_hour = list(calendar.timeline.overlapping(start_time, end_time))

            hora_str = hora.strftime("%H:%M")

            if events_in_hour:
                schedule_status[hora_str] = "ocupado"
            else:
                schedule_status[hora_str] = "livre"

        return schedule_status

    except Exception as e:
        logging.error(f"Erro detalhado ao processar a URL {url}: {e}", exc_info=True)

        horas = [time(h) for h in range(6, 21)]
        return {h.strftime("%H:%M"): "desconhecido" for h in horas}
