#!/bin/bash
# Script para iniciar os servidores do frontend e do backend.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Iniciando os servidores do Monitor de Salas ---"

# 1. Verificar se a instalação foi executada
if [ ! -d "venv" ]; then
    echo "Erro: O ambiente virtual 'venv' não foi encontrado."
    echo "Por favor, execute 'bash install.sh' primeiro."
    exit 1
fi

# 2. Iniciar o servidor do backend com nohup para garantir que continue rodando
echo "Iniciando servidor do backend (Uvicorn)..."
nohup ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir backend > backend.log 2>&1 &
BACKEND_PID=$!

# 3. Fazer o build e servir o frontend com nohup
echo "Iniciando servidor do frontend (React)..."
echo "Executando o build do frontend (pode levar um momento)..."
npm run build --prefix frontend > frontend-build.log 2>&1
echo "Servindo os arquivos estáticos do frontend..."
# Usando http-server com suporte para SPA
nohup npx http-server frontend/build -p 3000 --spa > frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 5 # Dar um tempo para os servidores iniciarem

echo ""
echo "--- Aplicação iniciada com sucesso! ---"
echo "Frontend (acesse no seu navegador): http://localhost:3000"
echo "Backend está rodando na porta 8000."
echo ""
echo "LOGS:"
echo "Backend: tail -f backend.log"
echo "Frontend: tail -f frontend.log"
echo ""
echo "COMO PARAR A APLICAÇÃO:"
echo "Execute o seguinte comando para parar os servidores:"
echo "kill $BACKEND_PID $FRONTEND_PID"
