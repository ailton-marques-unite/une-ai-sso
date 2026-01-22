#!/bin/bash

# Script para limpar chaves de rate limiting do Redis
# Útil durante desenvolvimento quando você atinge os limites

REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=${REDIS_PASSWORD:-}

echo "Limpando chaves de throttler do Redis..."

if [ -z "$REDIS_PASSWORD" ]; then
  redis-cli -h $REDIS_HOST -p $REDIS_PORT --scan --pattern "throttler:*" | xargs -L 1 redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL
  redis-cli -h $REDIS_HOST -p $REDIS_PORT --scan --pattern "rl:*" | xargs -L 1 redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL
else
  redis-cli -h $REDIS_HOST -p $REDIS_PORT -a "$REDIS_PASSWORD" --scan --pattern "throttler:*" | xargs -L 1 redis-cli -h $REDIS_HOST -p $REDIS_PORT -a "$REDIS_PASSWORD" DEL
  redis-cli -h $REDIS_HOST -p $REDIS_PORT -a "$REDIS_PASSWORD" --scan --pattern "rl:*" | xargs -L 1 redis-cli -h $REDIS_HOST -p $REDIS_PORT -a "$REDIS_PASSWORD" DEL
fi

echo "Chaves de throttler limpas com sucesso!"
