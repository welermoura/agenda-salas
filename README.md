# Monitor de Salas de Reunião

Esta aplicação web permite cadastrar URLs de calendários públicos (em formato `.ics`) e exibir em tempo real a disponibilidade das salas de reunião associadas.

## Tecnologias

- **Frontend:** React
- **Backend:** FastAPI (Python)
- **Comunicação em tempo real:** WebSockets

## Como Instalar e Executar

### Pré-requisitos

- Python 3.8+ (com o módulo `venv` disponível)
- Node.js e npm

### Passo 1: Instalação

Primeiro, execute o script de instalação. Ele irá criar um ambiente virtual para o Python, instalar todas as dependências do backend e do frontend, e preparar o script de inicialização.

```bash
bash install.sh
```

### Passo 2: Execução

Após a instalação ser concluída, inicie a aplicação com o seguinte comando:

```bash
bash start.sh
```

A aplicação estará disponível nos seguintes endereços:
- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend:** [http://localhost:8000](http://localhost:8000)

O script `start.sh` também mostrará os comandos para visualizar os logs e para parar a aplicação.

### Como Usar

1.  Abra a aplicação em [http://localhost:3000](http://localhost:3000).
2.  No campo de texto, insira a URL pública de um calendário no formato `.ics`.
3.  Clique em "Adicionar".
4.  A URL será adicionada à lista, e o status de disponibilidade ("livre", "ocupado" ou "desconhecido") será exibido e atualizado em tempo real (a cada 60 segundos).

## Estrutura do Projeto

- `backend/`: Código do servidor FastAPI.
- `frontend/`: Código da aplicação React.
- `venv/`: Diretório do ambiente virtual Python (criado pelo `install.sh`).
- `install.sh`: Script para instalar todas as dependências.
- `start.sh`: Script para iniciar a aplicação.
