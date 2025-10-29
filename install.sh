#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Iniciando instalação do Backend ---"

# Verifica se o ambiente virtual já existe, se não, cria.
if [ ! -d "venv" ]; then
    echo "Criando ambiente virtual..."
    python3 -m venv venv
else
    echo "Ambiente virtual já existe."
fi

# Ativa o ambiente virtual para instalar as dependências
source venv/bin/activate
echo "Instalando dependências do Python..."
pip install -r backend/requirements.txt
deactivate

echo "--- Backend instalado com sucesso ---"

echo ""

echo "--- Iniciando instalação do Frontend ---"
echo "Instalando dependências do Node.js..."
npm install --prefix frontend
echo "--- Frontend instalado com sucesso ---"

echo ""
echo "Instalação concluída! Execute ./start.sh para iniciar a aplicação."
