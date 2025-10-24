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

# --- 2. Compilar e servir o Frontend (React) ---
echo "=> Compilando o frontend para produção (isso pode levar alguns minutos)..."
npm run build --prefix frontend

echo "=> Verificando se o 'serve' está instalado..."
if ! command -v serve &> /dev/null
then
    echo "'serve' não encontrado. Instalando globalmente..."
    npm install -g serve
fi

echo "=> Iniciando o servidor de arquivos estáticos para o frontend em segundo plano..."
serve -s frontend/build -l 3000 > frontend_serve.log 2>&1 &
FRONTEND_PID=$!
echo "Servidor do frontend iniciado com PID: $FRONTEND_PID"

# --- 3. Exibir informações de acesso ---
# Aguarda um pouco mais para que os servidores iniciem
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
