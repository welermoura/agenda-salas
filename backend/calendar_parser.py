import requests
from ics import Calendar
from datetime import datetime, time, timedelta
import arrow

def get_room_status(url: str) -> dict:
    """
    Verifica o status de uma sala para cada hora do dia (06:00 - 20:00),
    usando um método robusto para tratar eventos de dia inteiro e um proxy
    para contornar bloqueios de CORS.

    Retorna um dicionário onde a chave é a hora e o valor é 'livre' ou 'ocupado'.
    """
    try:
        # Utiliza um proxy para evitar problemas de CORS e bloqueios de servidores
        proxy_url = f"https://cors-anywhere.herokuapp.com/{url}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Origin": "http://localhost:3000",
            "X-Requested-With": "XMLHttpRequest",
        }

        response = requests.get(proxy_url, headers=headers)
        response.raise_for_status()
        calendar = Calendar(response.text)

        # Define o dia de hoje e os horários de verificação
        today_utc = arrow.utcnow().to('utc').floor('day')
        horas = [time(h) for h in range(6, 21)] # Das 06:00 às 20:00

        schedule_status = {}

        for hora in horas:
            # Define o intervalo de uma hora para a verificação
            start_time = today_utc.replace(hour=hora.hour, minute=hora.minute).datetime
            end_time = start_time + timedelta(hours=1)

            # Utiliza o método 'overlapping' para verificar se há eventos no intervalo
            # Este método trata corretamente eventos de dia inteiro e fusos horários
            events_in_hour = list(calendar.timeline.overlapping(start_time, end_time))

            hora_str = hora.strftime("%H:%M")

            if events_in_hour:
                schedule_status[hora_str] = "ocupado"
            else:
                schedule_status[hora_str] = "livre"

        return schedule_status

    except Exception as e:
        print(f"Erro ao processar o calendário da URL {url}: {e}")
        # Retorna um dicionário com todos os horários como 'desconhecido' em caso de erro
        horas = [time(h) for h in range(6, 21)]
        return {h.strftime("%H:%M"): "desconhecido" for h in horas}
