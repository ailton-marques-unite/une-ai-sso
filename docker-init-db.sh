#!/bin/bash
set -e

# Variáveis com valores padrão
DATABASE_HOST=${DATABASE_HOST:-postgres}
DATABASE_PORT=${DATABASE_PORT:-5432}
DATABASE_USER=${DATABASE_USER:-postgres_uneaisso}
DATABASE_PASSWORD=${DATABASE_PASSWORD:-postgres_UneA1Ss0}
DATABASE_NAME=${DATABASE_NAME:-une_ai_sso}

# Timeout máximo em segundos (60 segundos)
MAX_WAIT_TIME=60
ELAPSED_TIME=0

# Aguardar PostgreSQL estar disponível
>&2 echo "Aguardando PostgreSQL estar disponível em $DATABASE_HOST:$DATABASE_PORT (usuário: $DATABASE_USER)..."
until PGPASSWORD=$DATABASE_PASSWORD psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "postgres" -c '\q' 2>/dev/null; do
  if [ $ELAPSED_TIME -ge $MAX_WAIT_TIME ]; then
    >&2 echo "ERRO: Timeout aguardando PostgreSQL após ${MAX_WAIT_TIME}s"
    >&2 echo "Verifique se o PostgreSQL está rodando e se as credenciais estão corretas."
    exit 1
  fi
  >&2 echo "PostgreSQL está indisponível - aguardando... (${ELAPSED_TIME}s/${MAX_WAIT_TIME}s)"
  sleep 2
  ELAPSED_TIME=$((ELAPSED_TIME + 2))
done

>&2 echo "PostgreSQL está disponível e pronto!"

# Criar banco de dados se não existir
>&2 echo "Verificando se o banco de dados '$DATABASE_NAME' existe..."
PGPASSWORD=$DATABASE_PASSWORD psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE $DATABASE_NAME'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DATABASE_NAME')\gexec
EOSQL

>&2 echo "Banco de dados $DATABASE_NAME verificado/criado com sucesso!"

# Executar migrations (opcional - pode ser feito manualmente)
# yarn migration:run

exec "$@"
