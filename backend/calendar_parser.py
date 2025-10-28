import requests
from ics import Calendar
from datetime import datetime, time
import arrow

def get_room_status(url: str) -> dict:
    """
    Verifica o status de uma sala para cada hora do dia (06:00 - 20:00).

    Retorna um dicionário onde a chave é a hora e o valor é 'livre' ou 'ocupado'.
    """
    try:
        # Faz o download e parse do calendário
        response = requests.get(url)
        response.raise_for_status()
        calendar = Calendar(response.text)

        # Define o dia de hoje e os horários de verificação
        today = arrow.utcnow().date()
        horas = [time(h) for h in range(6, 21)] # Das 06:00 às 20:00

        # Inicializa todos os horários como 'livre'
        schedule_status = {h.strftime("%H:%M"): "livre" for h in horas}

        # Converte os eventos para o fuso horário UTC para comparação
        events = sorted([event for event in calendar.events], key=lambda e: e.begin)

        for event in events:
            # Garante que o evento tenha um fuso horário para a comparação
            event_begin = arrow.get(event.begin.datetime).to('utc')
            event_end = arrow.get(event.end.datetime).to('utc')

            # Itera sobre cada hora do dia para verificar se há conflito
            for hora in horas:
                # Cria um objeto arrow para a hora atual no dia de hoje
                hora_utc = arrow.get(datetime.combine(today, hora)).to('utc')

                # Verifica se a hora está dentro do período do evento
                if event_begin <= hora_utc < event_end:
                    schedule_status[hora.strftime("%H:%M")] = "ocupado"

        return schedule_status

    except Exception as e:
        print(f"Erro ao processar o calendário da URL {url}: {e}")
        # Retorna um dicionário com todos os horários como 'desconhecido' em caso de erro
        horas = [time(h) for h in range(6, 21)]
        return {h.strftime("%H:%M"): "desconhecido" for h in horas}
