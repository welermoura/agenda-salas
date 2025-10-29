#!/bin/bash

# Função para parar os processos em background ao sair
cleanup() {
    echo "Parando servidores..."
    # Mata todos os processos filhos deste script
    pkill -P $$
    exit
}

# Captura o sinal de interrupção (Ctrl+C) e chama a função cleanup
trap cleanup INT

echo "--- Iniciando servidor Backend ---"
# Inicia o servidor FastAPI em background
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir backend &
BACKEND_PID=$!
echo "Backend rodando no PID: $BACKEND_PID"

echo ""

echo "--- Iniciando servidor Frontend ---"
# Inicia o servidor React em background
npm start --prefix frontend &
FRONTEND_PID=$!
echo "Frontend rodando no PID: $FRONTEND_PID"

echo ""
echo "Aplicação iniciada!"
echo "Acesse o frontend em http://localhost:3000"
echo "Pressione Ctrl+C para parar todos os servidores."

# Mantém o script em execução para que o trap funcione
wait
