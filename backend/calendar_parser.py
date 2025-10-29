import requests
from ics import Calendar
from datetime import time
import arrow

def get_room_status(url: str) -> dict:
    """
    Verifica o status de uma sala para cada hora do dia (06:00 - 20:00),
    usando a lógica original de análise de eventos.
    """
    schedule_status = {}
    horas = [time(h) for h in range(6, 21)] # Das 06:00 às 20:00

    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        calendar = Calendar(response.text)

        # Converte os eventos para objetos arrow para facilitar a comparação
        events = [
            (arrow.get(event.begin.datetime).to('local'), arrow.get(event.end.datetime).to('local'))
            for event in calendar.events
        ]

        today = arrow.utcnow().date()

        for hora in horas:
            hora_str = hora.strftime("%H:%M")
            # Cria um objeto arrow para a hora atual no dia de hoje, em UTC
            hora_utc = arrow.get(today).replace(hour=hora.hour, minute=hora.minute).to('utc')

            # Assume que a hora está livre até que se prove o contrário
            schedule_status[hora_str] = "livre"

            # Verifica se a hora atual cai dentro de algum evento
            for begin, end in events:
                if begin <= hora_utc < end:
                    schedule_status[hora_str] = "ocupado"
                    break # Se encontrou um evento, não precisa verificar os outros

        return schedule_status

    except Exception as e:
        print(f"Erro ao processar o calendário da URL {url}: {e}")
        return {h.strftime("%H:%M"): "desconhecido" for h in horas}
