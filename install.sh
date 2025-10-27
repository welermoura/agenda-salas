#!/bin/bash
# Script para instalar todas as dependências do projeto.
# Ele garante uma instalação limpa, removendo ambientes virtuais antigos.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Iniciando a instalação do Monitor de Salas ---"

# 1. Limpeza do ambiente virtual antigo (se existir)
if [ -d "venv" ]; then
    echo "Removendo ambiente virtual antigo..."
    rm -rf venv
fi

# 2. Criação de um novo ambiente virtual Python
echo "Criando um novo ambiente virtual Python em ./venv..."
python3 -m venv venv

# 3. Instalação das dependências do backend
echo "Instalando dependências do backend (Python) dentro do ambiente virtual..."
# Usar o pip de dentro do venv garante que os pacotes sejam instalados no local correto.
./venv/bin/pip install -r backend/requirements.txt

# 4. Instalação das dependências do frontend
echo "Instalando dependências do frontend (Node.js)..."
npm install --prefix frontend

# 5. Tornar o script de inicialização executável
chmod +x start.sh

echo ""
echo "--- Instalação concluída com sucesso! ---"
echo "Para iniciar a aplicação, execute o seguinte comando:"
echo "bash start.sh"
