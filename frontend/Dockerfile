# --- Estágio 1: Build da Aplicação React ---
FROM node:20 AS builder

# Define o diretório de trabalho
WORKDIR /app

# Copia o package.json e o package-lock.json para aproveitar o cache
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o resto do código do frontend
COPY . .

# Faz a build da aplicação para produção
RUN npm run build

# --- Estágio 2: Servir a Aplicação com Nginx ---
FROM nginx:stable-alpine

# Copia os ficheiros estáticos da build do estágio anterior
COPY --from=builder /app/build /usr/share/nginx/html

# Remove a configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia a nossa configuração personalizada do Nginx
# Esta configuração será criada no próximo passo e irá lidar com o reverse proxy
COPY nginx.conf /etc/nginx/conf.d

# Expõe a porta 80
EXPOSE 80

# Comando para arrancar o Nginx
CMD ["nginx", "-g", "daemon off;"]
