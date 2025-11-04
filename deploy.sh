#!/bin/bash

# --- Script de Deploy Dinâmico para Aplicação em Debian com Apache ---

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

# --- 1. Verificações Iniciais e Input do Usuário ---
log "Iniciando o script de deploy..."

if [ "$EUID" -ne 0 ]; then
    error "Este script precisa ser executado como root. Use 'sudo ./deploy.sh'"
fi

read -p "Digite o hostname para a aplicação (ex: agendas, salas): " APP_HOSTNAME
if [ -z "$APP_HOSTNAME" ]; then
    error "O hostname não pode ser vazio."
fi

read -p "Digite o nome de usuário para o serviço do backend (ex: www-data): " APP_USER
if [ -z "$APP_USER" ]; then
    error "O nome de usuário não pode ser vazio."
fi

log "Configurando a aplicação para o hostname: $APP_HOSTNAME"

# --- 2. Instalação de Dependências ---
if confirm "Deseja instalar/atualizar as dependências do sistema (Apache, Python, Node.js)?"; then
    log "Tentando corrigir possíveis pacotes quebrados..."
    dpkg --configure -a
    apt-get --fix-broken install -y
    apt-get update
    apt-get install -y apache2 python3-venv curl || error "Falha ao instalar dependências base."
    if ! command -v node >/dev/null; then
        log "Instalando Node.js LTS (v20.x)..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs || error "Falha ao instalar Node.js."
    fi
    success "Dependências do sistema instaladas."
fi

# --- 3. Build do Frontend ---
log "Iniciando a build do frontend..."
npm install --prefix frontend || error "Falha no 'npm install'."
npm run build --prefix frontend || error "Falha no 'npm run build'."
success "Frontend build concluída."

# --- 4. Configuração dos Diretórios de Produção ---
APP_DIR="/opt/$APP_HOSTNAME"
WEB_DIR="/var/www/$APP_HOSTNAME"
LOG_DIR="/var/log/$APP_HOSTNAME"

log "Criando diretórios em $APP_DIR, $WEB_DIR e $LOG_DIR..."
mkdir -p $APP_DIR/backend $APP_DIR/tmp $WEB_DIR $LOG_DIR

# --- Gerenciamento Centralizado do config.json ---
CONFIG_PATH="$APP_DIR/config.json"
CONFIG_BACKUP_PATH="$APP_DIR/tmp/config.json.bkp"

log "Fazendo backup do config.json existente de $CONFIG_PATH..."
if [ -f "$CONFIG_PATH" ]; then
    mv "$CONFIG_PATH" "$CONFIG_BACKUP_PATH"
    log "Backup do config.json criado em $CONFIG_BACKUP_PATH"
fi

log "Copiando arquivos da aplicação (excluindo o config.json do backend)..."
rsync -a --exclude 'config.json' backend/ "$APP_DIR/backend/"
cp start.sh install.sh $APP_DIR/ 2>/dev/null || true
cp -r frontend/build/* $WEB_DIR/

log "Restaurando o config.json..."
if [ -f "$CONFIG_BACKUP_PATH" ]; then
    mv "$CONFIG_BACKUP_PATH" "$CONFIG_PATH"
    log "config.json restaurado para $CONFIG_PATH."
else
    if [ ! -f "$CONFIG_PATH" ]; then
        log "Nenhum config.json encontrado. Criando um ficheiro de configuração inicial em $CONFIG_PATH."
        echo '{
            "is_configured": false,
            "admin_password_hash": null,
            "graph_tenant_id": null,
            "graph_client_id": null,
            "graph_client_secret": null,
            "rooms": []
        }' > "$CONFIG_PATH"
    fi
fi

log "Configurando o ambiente virtual Python..."
python3 -m venv $APP_DIR/venv || error "Falha ao criar venv."
$APP_DIR/venv/bin/pip install --no-cache-dir -r $APP_DIR/backend/requirements.txt || error "Falha ao instalar dependências Python."

log "Ajustando permissões..."
# O dono do diretório principal deve ser o usuário da app para permitir a criação do config.json
chown -R $APP_USER:www-data $APP_DIR
chown -R www-data:www-data $WEB_DIR
chown -R $APP_USER:www-data $LOG_DIR
# Garante que o grupo possa escrever no config.json e nos diretórios temporários
chmod -R g+w $APP_DIR
chmod g+w $LOG_DIR

success "Diretórios de produção configurados."

# --- 5. Configuração do Apache ---
if confirm "Deseja configurar o Apache?"; then
    APACHE_CONF_FILE="/etc/apache2/sites-available/$APP_HOSTNAME.conf"
    log "Gerando o arquivo de configuração do VirtualHost em $APACHE_CONF_FILE..."
    sed "s/__HOSTNAME__/$APP_HOSTNAME/g" deploy/apache_template.conf > $APACHE_CONF_FILE

    log "Habilitando os módulos necessários do Apache..."
    a2enmod proxy proxy_http proxy_wstunnel rewrite || error "Falha ao habilitar módulos."

    log "Habilitando o site '$APP_HOSTNAME'..."
    a2ensite $APP_HOSTNAME || error "Falha ao habilitar o site."

    log "Verificando a sintaxe da configuração do Apache..."
    apache2ctl configtest || error "Erro de sintaxe na configuração do Apache."

    log "Reiniciando o Apache..."
    systemctl restart apache2 || error "Falha ao reiniciar o Apache."
    success "Apache configurado."
fi

# --- 6. Configuração do Systemd ---
if confirm "Deseja configurar o serviço do backend com systemd?"; then
    SERVICE_FILE="/etc/systemd/system/$APP_HOSTNAME.service"
    log "Gerando o arquivo de serviço do systemd em $SERVICE_FILE..."

    # Substitui o hostname e o usuário no template
    sed -e "s/__HOSTNAME__/$APP_HOSTNAME/g" -e "s/User=seu_usuario/User=$APP_USER/" deploy/service_template.service > $SERVICE_FILE

    log "Recarregando o daemon do systemd..."
    systemctl daemon-reload

    log "Habilitando e iniciando o serviço '$APP_HOSTNAME'..."
    systemctl enable $APP_HOSTNAME.service || error "Falha ao habilitar o serviço."
    systemctl start $APP_HOSTNAME.service || error "Falha ao iniciar o serviço."
    success "Serviço do backend configurado e iniciado."
fi

# --- Conclusão ---
success "O deploy da aplicação foi concluído!"
echo "--------------------------------------------------------"
echo "Acesse a aplicação no seu navegador:"
echo -e "Lembre-se de configurar o DNS local para que '${C_GREEN}$APP_HOSTNAME${C_NONE}' aponte para o IP deste servidor."
echo -e "URL: ${C_GREEN}http://$APP_HOSTNAME${C_NONE}"
echo "--------------------------------------------------------"
echo "Para verificar o status do serviço do backend, use:"
echo "sudo systemctl status $APP_HOSTNAME.service"
echo "--------------------------------------------------------"
