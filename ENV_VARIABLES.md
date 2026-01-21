# Variáveis de Ambiente

Este arquivo lista todas as variáveis de ambiente necessárias para o projeto. Copie este conteúdo para um arquivo `.env` na raiz do projeto.

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
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ============================================
# APPLICATION
# ============================================
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info

# ============================================
# JWT (será implementado na Fase 1.4)
# ============================================
JWT_SECRET=your-secret-key-change-in-production
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TOKEN_EXPIRES_IN=1h
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# ============================================
# SECURITY
# ============================================
BCRYPT_ROUNDS=10
PASSWORD_RESET_TOKEN_EXPIRES_IN=30m
MFA_CODE_EXPIRES_IN=5m
SESSION_MAX_AGE=7d

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
# MONITORAMENTO
# ============================================
SENTRY_DSN=
```

## Instruções

1. Copie o conteúdo acima para um arquivo `.env` na raiz do projeto
2. Ajuste os valores conforme seu ambiente
3. **NUNCA** commite o arquivo `.env` no repositório (já está no .gitignore)
