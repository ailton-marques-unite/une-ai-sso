# Configuração do Banco de Dados - Multi-Tenancy

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```bash
# ============================================
# BANCO DE DADOS
# ============================================
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres_uneaisso
DATABASE_PASSWORD=postgres_UneA1Ss0
DATABASE_NAME=une_ai_sso
DATABASE_URL=postgresql://postgres_uneaisso:postgres_UneA1Ss0@localhost:5432/une_ai_sso
DATABASE_SSL=false
DATABASE_SYNC=false

# ============================================
# REDIS
# ============================================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# ============================================
# JWT
# ============================================
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TOKEN_EXPIRES_IN=1h
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# ============================================
# MICROSOFT SSO
# ============================================
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_REDIRECT_URI=https://api.une.cx/auth/sso/callback

# ============================================
# GOOGLE SSO
# ============================================
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api.une.cx/auth/sso/callback

# ============================================
# EMAIL (SENDGRID)
# ============================================
SENDGRID_API_KEY=
EMAIL_FROM=noreply@une.cx
EMAIL_FROM_NAME=Une.cx

# ============================================
# SMS (TWILIO)
# ============================================
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# ============================================
# MFA
# ============================================
MFA_ISSUER=Une.cx
MFA_ENCRYPTION_KEY=

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5

# ============================================
# SEGURANÇA
# ============================================
PASSWORD_RESET_TOKEN_EXPIRES_IN=30m
MFA_CODE_EXPIRES_IN=5m
SESSION_MAX_AGE=7d

# ============================================
# MONITORAMENTO
# ============================================
SENTRY_DSN=
LOG_LEVEL=info

# ============================================
# GERAL
# ============================================
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

## Executando com Docker Compose

1. Inicie os serviços:
```bash
docker-compose up -d
```

2. Execute as migrations:
```bash
yarn migration:run
```

## Executando Localmente

1. Certifique-se de que o PostgreSQL está rodando na porta 5432
2. Crie o banco de dados:
```bash
createdb une_ai_sso
```

3. Execute as migrations:
```bash
yarn migration:run
```

## Scripts de Migration Disponíveis

- `yarn migration:generate` - Gera uma nova migration baseada nas entidades
- `yarn migration:run` - Executa todas as migrations pendentes
- `yarn migration:revert` - Reverte a última migration executada
- `yarn migration:show` - Mostra o status das migrations
- `yarn schema:sync` - Sincroniza o schema (apenas desenvolvimento)

## Estrutura das Migrations

As migrations estão localizadas em `src/database/migrations/` e seguem a ordem:

1. `CreateDomainsTable` - Tabela de domínios/organizações
2. `CreateDomainRolesTable` - Tabela de papéis por domínio
3. `CreateUsersTableWithDomain` - Tabela de usuários com domain_id
4. `CreateUserRolesTable` - Tabela de associação usuário-papel
5. `CreateSessionsTableWithDomain` - Tabela de sessões com domain_id
6. `CreateAuditLogsTableWithDomain` - Tabela de logs de auditoria com domain_id
7. `CreateUserMfaTable` - Tabela de configurações MFA
8. `CreatePasswordResetTokensTable` - Tabela de tokens de reset de senha

## Modelo Multi-Tenancy

O sistema implementa **Hard Isolation** através de:
- Foreign keys em `domain_id` em todas as tabelas relacionadas
- Constraint UNIQUE(domain_id, email) na tabela users
- Índices otimizados em `domain_id` para performance
- Queries sempre filtradas por `domain_id` (defense in depth)
