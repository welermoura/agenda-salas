import subprocess
from ics import Calendar
from datetime import time, date
import arrow
import logging

def get_room_status(url: str) -> dict:
    """
    Verifica o status de uma sala para cada hora do dia (06:00 - 20:00),
    usando o comando `curl` para descarregar o calendário e evitar problemas de bloqueio.
    """
    schedule_status = {}
    horas = [time(h) for h in range(6, 21)]
    timezone = 'America/Sao_Paulo'

    try:
        logging.info(f"A descarregar o calendário com curl da URL: {url}")

        # Comando curl para descarregar o conteúdo com um User-Agent de navegador
        command = [
            'curl',
            '-L',  # Seguir redirecionamentos
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            url
        ]

        # Executa o comando e captura a saída
        result = subprocess.run(command, capture_output=True, text=True, check=True, timeout=30)
        calendar_data = result.stdout

        logging.info(f"Calendário descarregado com sucesso. A processar {len(calendar_data)} bytes.")

        calendar = Calendar(calendar_data)
        today = arrow.utcnow().to(timezone).date()
        schedule_status = {h.strftime("%H:%M"): "livre" for h in horas}

        events_today = []
        for event in calendar.events:
            try:
                begin = arrow.get(event.begin.datetime).to(timezone)
                if begin.date() == today:
                    events_today.append(event)
            except Exception:
                continue

        for hora in horas:
            hora_str = hora.strftime("%H:%M")
            hora_local = arrow.get(date.today()).replace(hour=hora.hour, minute=hora.minute, tzinfo=timezone)

            for event in events_today:
                try:
                    begin = arrow.get(event.begin.datetime).to(timezone)
                    end = arrow.get(event.end.datetime).to(timezone)

                    if begin <= hora_local < end and not event.transparent:
                        schedule_status[hora_str] = "ocupado"
                        break
                except Exception:
                    continue

        logging.info(f"Estado final do agendamento: {schedule_status}")
        return schedule_status

    except subprocess.CalledProcessError as e:
        logging.error(f"O comando curl falhou com o código de saída {e.returncode} para a URL {url}.", exc_info=True)
        logging.error(f"Stderr do Curl: {e.stderr}")
        return {h.strftime("%H:%M"): "desconhecido" for h in horas}
    except Exception as e:
        logging.error(f"Erro inesperado ao processar o calendário da URL {url}: {e}", exc_info=True)
        return {h.strftime("%H:%M"): "desconhecido" for h in horas}
