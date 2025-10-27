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

# 2. Iniciar o servidor do backend em segundo plano com hypercorn
echo "Iniciando servidor do backend (Hypercorn)..."
# Redirecionar stdout e stderr para o arquivo de log para capturar todos os erros.
./venv/bin/hypercorn backend.main:app --bind 0.0.0.0:8000 > backend.log 2>&1 &
BACKEND_PID=$!

# 3. Iniciar o servidor do frontend em segundo plano
echo "Iniciando servidor do frontend (React)..."
# Redirecionar stdout e stderr para o arquivo de log.
npm start --prefix frontend > frontend.log 2>&1 &
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
