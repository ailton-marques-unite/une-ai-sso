FROM node:22

# Instalar cliente PostgreSQL para migrations e scripts
RUN apt-get update && \
    apt-get install -y postgresql-client && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /srv/app

COPY package.json yarn.lock ./

RUN yarn install --quiet --no-optional --no-fund --loglevel=error

COPY . .

RUN export $(cat .env | grep -v '^#' | xargs) && npm run build

# Script de inicialização do banco de dados
COPY docker-init-db.sh /docker-init-db.sh
RUN chmod +x /docker-init-db.sh

# Expor porta
EXPOSE 3000

# Executar script de inicialização e depois iniciar a aplicação
CMD ["/docker-init-db.sh", "yarn", "start:dev"]



