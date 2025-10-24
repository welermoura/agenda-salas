# Monitor de Salas de Reunião

Esta aplicação web permite cadastrar URLs de calendários públicos do Microsoft Teams (em formato `.ics`) e exibir em tempo real a disponibilidade das salas de reunião associadas.

## Tecnologias

- **Frontend:** React
- **Backend:** FastAPI (Python)
- **Comunicação em tempo real:** WebSockets

## Como Instalar e Executar

### Pré-requisitos

- Python 3.8+ e pip
- Node.js e npm

### 1. Instalação

Execute o script de instalação para baixar todas as dependências do backend e do frontend.

```bash
bash install.sh
```

### 2. Execução

Execute o script de inicialização para iniciar os servidores do backend e do frontend.

```bash
bash start.sh
```

Após a execução, a aplicação estará disponível nos seguintes endereços:

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend:** [http://localhost:8000](http://localhost:8000)

### 3. Como Usar

1.  Abra o frontend em [http://localhost:3000](http://localhost:3000).
2.  No campo de texto, insira a URL pública de um calendário no formato `.ics`.
3.  Clique em "Adicionar".
4.  A URL será adicionada à lista, e o status de disponibilidade ("livre", "ocupado" ou "desconhecido") será exibido e atualizado em tempo real.

## Estrutura do Projeto

- `backend/`: Contém o código do servidor FastAPI.
- `frontend/`: Contém o código da aplicação React.
- `install.sh`: Script para instalar todas as dependências.
- `start.sh`: Script para iniciar a aplicação.
