# Estágio 1: Imagem base com Python
FROM python:3.11-slim

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia o ficheiro de dependências primeiro para aproveitar o cache do Docker
COPY requirements.txt .

# Instala as dependências
RUN pip install --no-cache-dir -r requirements.txt

# Copia o resto do código da aplicação para o diretório de trabalho
COPY . .

# Expõe a porta que a aplicação vai usar
EXPOSE 8000

# Comando para arrancar a aplicação
# Nota: Não usamos --app-dir porque o Working Directory já é o 'backend'
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
