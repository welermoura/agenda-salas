# Agenda de Salas - Configuração de Rede, Docker e Proxy Reverso (Nginx)

Este documento fornece as instruções e o modelo arquitetural para a implantação segura da Agenda de Salas em ambientes de homologação e produção utilizando Docker e Nginx como Proxy Reverso centralizado com suporte a HTTPS e WebSockets.

---

## 🏗️ Arquitetura de Rede e Fluxo de Dados

A infraestrutura é dividida em camadas para garantir segurança e escalabilidade:

```mermaid
graph TD
    Client[Navegador do Cliente] -- HTTPS / WSS (Porta 443) --> Proxy[Nginx Central / Reverso]
    Proxy -- HTTP (Porta 8090) --> FE[Frontend Container (React/Nginx)]
    FE -- proxy_pass /api --> BE[Backend Container (FastAPI)]
    FE -- proxy_pass /ws --> BE
```

1. **Cliente:** Acessa `https://agendasalas` (porta 443).
2. **Proxy Reverso Central (Nginx Host):**
   - Recebe a conexão criptografada SSL (HTTPS).
   - Redireciona conexões HTTP comuns da porta 80 para HTTPS.
   - Encaminha o tráfego regular (`/`) e o tráfego WebSocket (`/ws`) para o container do frontend.
3. **Frontend (Container Docker - Porta 8090):**
   - Serve os arquivos estáticos do React.
   - Contém um Nginx interno que repassa requisições `/api` e `/ws` para o container do backend.
4. **Backend (Container Docker - Porta 8000):**
   - Servidor FastAPI/Uvicorn que processa as regras de negócio e integrações com o Microsoft Graph API.

---

## ⚙️ Configuração do Proxy Reverso Central (Nginx)

O modelo de configuração do Nginx encontra-se no arquivo [deploy/nginx_template.conf](deploy/nginx_template.conf).

### Detalhes Importantes:
* **Redirecionamento HTTP para HTTPS:** Configurado no bloco da porta 80 para forçar o navegador a usar conexões seguras.
* **WebSocket Upgrade:** O bloco `/ws` no Nginx central é fundamental. Sem ele, os cabeçalhos `Upgrade` e `Connection` são descartados, impedindo que o painel atualize em tempo real.

```nginx
location /ws {
    proxy_pass http://10.10.1.206:8090;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    ...
}
```

---

## 🚀 Implantação e Variáveis de Ambiente (Docker)

Para que a detecção de protocolo funcione automaticamente em ambientes HTTPS, é essencial que o frontend **não** seja compilado com uma URL de WebSocket estática/insegura.

No arquivo `docker-compose.yml`, certifique-se de que a variável de build `REACT_APP_WS_URL` esteja comentada no serviço `frontend`:

```yaml
  frontend:
    build:
      context: ./frontend
      # args:
      #   REACT_APP_WS_URL: ws://agendasalas:8090/ws
```

### Comportamento Dinâmico (Implementado):
Quando `REACT_APP_WS_URL` está ausente, o código em [DashboardPage.js](frontend/src/DashboardPage.js) resolve o protocolo de comunicação de forma dinâmica em tempo de execução no cliente:
* Se acessado via `https://agendasalas/` ➔ Conecta em `wss://agendasalas/ws` (Seguro).
* Se acessado via `http://agendasalas:8090/` ➔ Conecta em `ws://agendasalas:8090/ws` (Inseguro).

### Comandos de Deploy (Servidor):
Sempre que fizer alterações no código ou nas configurações do Docker Compose, reconstrua as imagens para aplicar as mudanças:

```bash
# Navegar até o diretório da aplicação
cd /containers/agendasalas

# Reconstruir e subir os containers em segundo plano
docker compose up --build -d
```
