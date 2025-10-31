#!/bin/bash

# --- Script de Deploy para AgendaSalas em Debian com Apache ---

# Cores para o output
C_BLUE="\033[0;34m"
C_GREEN="\033[0;32m"
C_RED="\033[0;31m"
C_NONE="\033[0m"

# Função para imprimir mensagens de log
log() {
    echo -e "${C_BLUE}INFO:${C_NONE} $1"
}

# Função para imprimir mensagens de sucesso
success() {
    echo -e "${C_GREEN}SUCCESS:${C_NONE} $1"
}

# Função para imprimir erros e sair
error() {
    echo -e "${C_RED}ERROR:${C_NONE} $1" >&2
    exit 1
}

# Função para pedir confirmação do usuário
confirm() {
    read -p "$1 [y/N]: " response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# --- 1. Verificações Iniciais ---
log "Iniciando o script de deploy da aplicação AgendaSalas..."

if [ "$EUID" -ne 0 ]; then
    error "Este script precisa ser executado como root. Use 'sudo ./deploy.sh'"
fi

read -p "Por favor, digite o nome de usuário que irá rodar o serviço do backend (ex: www-data ou um usuário dedicado): " APP_USER
if [ -z "$APP_USER" ]; then
    error "O nome de usuário não pode ser vazio."
fi

# --- 2. Instalação de Dependências ---
if confirm "Deseja instalar/atualizar as dependências do sistema (Apache, Python, Node.js)?"; then
    log "Tentando corrigir possíveis pacotes quebrados..."
    dpkg --configure -a
    apt-get --fix-broken install -y

    log "Atualizando a lista de pacotes..."
    apt-get update

    log "Instalando dependências base (apache2, python3-venv, curl)..."
    apt-get install -y apache2 python3-venv curl || error "Falha ao instalar dependências base."

    # Instalação do Node.js e npm via NodeSource (método recomendado)
    if ! command -v node >/dev/null; then
        log "Instalando Node.js LTS (v20.x) via NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs || error "Falha ao instalar Node.js via NodeSource."
    else
        log "Node.js já está instalado. Pulando."
    fi

    success "Dependências do sistema instaladas."
fi

# --- 3. Build do Frontend ---
log "Iniciando a build do frontend..."
log "Instalando dependências do Node.js (pode levar alguns minutos)..."
npm install --prefix frontend || error "Falha no 'npm install'."
log "Gerando a build de produção..."
npm run build --prefix frontend || error "Falha no 'npm run build'."
success "Frontend build concluída. Arquivos em 'frontend/build'."

# --- 4. Configuração dos Diretórios de Produção ---
log "Configurando os diretórios de produção..."
# Diretório da aplicação (backend e venv)
APP_DIR="/opt/agendasalas"
# Diretório web (frontend build)
WEB_DIR="/var/www/agendasalas"

log "Criando diretórios em $APP_DIR e $WEB_DIR..."
mkdir -p $APP_DIR/backend $APP_DIR/tmp $WEB_DIR

log "Copiando arquivos da aplicação..."
# Copia o diretório do backend e o start.sh
cp -r backend $APP_DIR/
cp start.sh install.sh $APP_DIR/ 2>/dev/null || true # Copia scripts auxiliares se existirem

# Copia os arquivos de build do frontend
cp -r frontend/build/* $WEB_DIR/

log "Configurando o ambiente virtual Python em $APP_DIR/venv..."
python3 -m venv $APP_DIR/venv || error "Falha ao criar venv."
source $APP_DIR/venv/bin/activate
$APP_DIR/venv/bin/pip install --no-cache-dir -r $APP_DIR/backend/requirements.txt || error "Falha ao instalar dependências Python. Verifique se o arquivo requirements.txt existe."
deactivate

log "Ajustando permissões..."
chown -R $APP_USER:www-data $APP_DIR
chown -R www-data:www-data $WEB_DIR
chmod -R 775 $APP_DIR/tmp

success "Diretórios de produção configurados."

# --- 5. Configuração do Apache ---
if confirm "Deseja configurar o Apache?"; then
    log "Copiando o arquivo de configuração do VirtualHost..."
    cp deploy/apache_agendasalas.conf /etc/apache2/sites-available/agendasalas.conf

    log "Habilitando os módulos necessários do Apache..."
    a2enmod proxy proxy_http proxy_wstunnel rewrite || error "Falha ao habilitar módulos do Apache."

    log "Habilitando o site 'agendasalas'..."
    a2ensite agendasalas || error "Falha ao habilitar o site."

    # A linha que desabilitava o site padrão foi REMOVIDA para evitar conflitos.

    log "Verificando a sintaxe da configuração do Apache..."
    apache2ctl configtest || error "Erro de sintaxe na configuração do Apache. Abortando."

    log "Reiniciando o Apache para aplicar as mudanças..."
    systemctl restart apache2 || error "Falha ao reiniciar o Apache."
    success "Apache configurado."
fi

# --- 6. Configuração do Systemd ---
if confirm "Deseja configurar o serviço do backend com systemd?"; then
    log "Copiando o arquivo de serviço do systemd..."
    cp deploy/agendasalas.service /etc/systemd/system/agendasalas.service

    log "Atualizando o nome de usuário no arquivo de serviço para '$APP_USER'..."
    sed -i "s/User=seu_usuario/User=$APP_USER/" /etc/systemd/system/agendasalas.service

    log "Recarregando o daemon do systemd..."
    systemctl daemon-reload

    log "Habilitando e iniciando o serviço 'agendasalas'..."
    systemctl enable agendasalas.service || error "Falha ao habilitar o serviço."
    systemctl start agendasalas.service || error "Falha ao iniciar o serviço."
    success "Serviço do backend configurado e iniciado."
fi

# --- Conclusão ---
success "O deploy da aplicação AgendaSalas foi concluído!"
echo "--------------------------------------------------------"
echo "Acesse a aplicação no seu navegador:"
echo -e "Lembre-se de configurar o DNS local para que '${C_GREEN}agendasalas${C_NONE}' aponte para o IP deste servidor."
echo -e "URL: ${C_GREEN}http://agendasalas${C_NONE}"
echo "--------------------------------------------------------"
echo "Para verificar o status do serviço do backend, use:"
echo "sudo systemctl status agendasalas.service"
echo "--------------------------------------------------------"
