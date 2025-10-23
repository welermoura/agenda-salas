#!/bin/bash

# Sai imediatamente se um comando falhar
set -e

echo "--- Iniciando a instalação da Ferramenta de Gestão de AD ---"

# --- 1. Atualizar e instalar dependências do sistema ---
echo "=> Atualizando pacotes do sistema e instalando dependências (isso pode levar alguns minutos)..."
sudo apt-get update
sudo apt-get install -y curl python3-pip python3-venv libldap2-dev libsasl2-dev

# --- 2. Instalar Node.js e npm ---
# Verifica se o Node.js está instalado
if ! command -v node > /dev/null; then
    echo "=> Node.js não encontrado. Instalando a versão 20.x..."
    # Adiciona o repositório do NodeSource para o Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "=> Node.js já está instalado."
fi
echo "Versão do Node.js: $(node -v)"
echo "Versão do npm: $(npm -v)"


# --- 3. Criar e ativar o ambiente virtual do Backend (Python) ---
echo "=> Criando ambiente virtual Python em 'backend/venv'..."
python3 -m venv backend/venv

echo "=> Instalando dependências do backend Python no ambiente virtual..."
# Ativa o venv para este comando
source backend/venv/bin/activate
pip install -r backend/requirements.txt
# Desativa o venv
deactivate


# --- 4. Instalar dependências do Frontend (Node.js) ---
echo "=> Instalando dependências do frontend Node.js (isso pode levar alguns minutos)..."
npm install --prefix frontend

# --- 5. Configurar o arquivo de ambiente ---
echo "=> Configurando o arquivo de ambiente .env..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "Arquivo 'backend/.env' criado. Por favor, edite-o com as suas configurações de AD."
else
    echo "Arquivo 'backend/.env' já existe. Nenhuma alteração foi feita."
fi

echo ""
echo "--- Instalação concluída com sucesso! ---"
echo "Próximos passos:"
echo "1. Edite o arquivo 'backend/.env' com as informações do seu Active Directory."
echo "2. Execute o script './start.sh' para iniciar a aplicação (não precisa torná-lo executável novamente)."
