#!/bin/bash

# Sai imediatamente se um comando falhar
set -e

echo "--- Iniciando a aplicação da Ferramenta de Gestão de AD ---"

# --- 1. Iniciar o Backend (FastAPI) ---
echo "=> Iniciando o servidor do backend em segundo plano..."
# Caminho para o executável do uvicorn dentro do venv
UVICORN_PATH="backend/venv/bin/uvicorn"
# Usamos --host 0.0.0.0 para que seja acessível na rede
$UVICORN_PATH backend.app:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "Servidor do backend iniciado com PID: $BACKEND_PID"

# --- 2. Iniciar o Frontend (React) ---
echo "=> Iniciando o servidor do frontend em segundo plano..."
# A porta 3000 é a padrão do create-react-app
npm start --prefix frontend > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Servidor do frontend iniciado com PID: $FRONTEND_PID"

# --- 3. Exibir informações de acesso ---
# Aguarda um pouco para que os servidores iniciem
sleep 5

# Obtém os endereços IP da máquina
IP_ADDRESSES=$(hostname -I)

echo ""
echo "--- Aplicação iniciada com sucesso! ---"
echo "Para acessar a aplicação, use um dos seguintes endereços no seu navegador:"
for ip in $IP_ADDRESSES; do
    echo "  http://$ip:3000"
done
echo ""
echo "Para parar a aplicação, use o comando:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo ""
