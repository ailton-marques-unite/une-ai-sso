#!/bin/bash
set -e

# Variáveis com valores padrão
DATABASE_HOST=${DATABASE_HOST:-postgres}
DATABASE_PORT=${DATABASE_PORT:-5432}
DATABASE_USER=${DATABASE_USER:-postgres}
DATABASE_PASSWORD=${DATABASE_PASSWORD:-postgres}
DATABASE_NAME=${DATABASE_NAME:-une_ai_sso}

# Aguardar PostgreSQL estar disponível
until PGPASSWORD=$DATABASE_PASSWORD psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "postgres" -c '\q' 2>/dev/null; do
  >&2 echo "PostgreSQL está indisponível - aguardando..."
  sleep 1
done

>&2 echo "PostgreSQL está disponível"

# Criar banco de dados se não existir
PGPASSWORD=$DATABASE_PASSWORD psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE $DATABASE_NAME'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DATABASE_NAME')\gexec
EOSQL

>&2 echo "Banco de dados $DATABASE_NAME verificado/criado"

# Executar migrations (opcional - pode ser feito manualmente)
# yarn migration:run

exec "$@"
