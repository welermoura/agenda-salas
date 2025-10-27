import requests
import json

API_URL = "http://localhost:8000/agendas"
TEST_AGENDA = {"name": "Sala de Teste Persistencia", "url": "http://example.com/persistencia.ics"}

try:
    response = requests.post(API_URL, json=TEST_AGENDA)
    response.raise_for_status()
    print("Agenda adicionada com sucesso via API.")
except Exception as e:
    print(f"Erro ao adicionar agenda: {e}")
    print(response.text)
