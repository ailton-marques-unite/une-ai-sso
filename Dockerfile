FROM node:22

WORKDIR /srv/app

COPY package.json yarn.lock ./

RUN yarn install --quiet --no-optional --no-fund --loglevel=error

COPY . .

RUN export $(cat .env | grep -v '^#' | xargs) && npm run build

# Expor porta
EXPOSE 3000

CMD ["yarn", "start"]



