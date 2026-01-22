# Exemplos de Uso da API - Autenticação, Usuários, MFA e SSO

Este documento contém exemplos de como usar os endpoints de autenticação, gerenciamento de usuários, MFA (Multi-Factor Authentication) e SSO (Single Sign-On) com Domain Context.

## Domain Context

O Domain Context pode ser fornecido de três formas:
1. **Header `x-domain-id`**: UUID do domínio
2. **Header `x-domain-slug`**: Slug do domínio (mais amigável)
3. **Query parameter `domain_id`**: UUID do domínio
4. **Query parameter `domain_slug`**: Slug do domínio

**Nota:** Todos os endpoints de autenticação e usuários requerem Domain Context, exceto onde indicado.

---

## 1. Autenticação

### 1.1 Registrar Novo Usuário (POST /auth/register)

**Requer Domain Context** - Cria um novo usuário no domínio especificado.

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/register' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "email": "usuario@example.com",
  "password": "SenhaSegura123!@#",
  "full_name": "João Silva",
  "phone": "+5511999999999"
}'
```

**Resposta esperada (201):**
```json
{
  "id": "uuid-do-usuario",
  "domain_id": "uuid-do-dominio",
  "email": "usuario@example.com",
  "full_name": "João Silva",
  "phone": "+5511999999999",
  "is_active": true,
  "is_verified": false,
  "mfa_enabled": false,
  "last_login_at": null,
  "created_at": "2026-01-22T12:00:00.000Z",
  "updated_at": "2026-01-22T12:00:00.000Z"
}
```

**Rate Limit:** 3 tentativas por hora

---

### 1.2 Login (POST /auth/login)

**Requer Domain Context** - Autentica um usuário e retorna tokens JWT.

**Nota:** O `domain_id` pode ser fornecido no body da requisição OU via header `x-domain-id` ou `x-domain-slug`. O middleware extrairá automaticamente o `domain_id` do contexto quando fornecido via header.

**Opção 1: Usando header x-domain-slug (Recomendado)**

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "email": "usuario@example.com",
  "password": "SenhaSegura123!@#"
}'
```

**Opção 2: Usando header x-domain-id**

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-id: uuid-do-dominio' \
  -d '{
  "email": "usuario@example.com",
  "password": "SenhaSegura123!@#"
}'
```

**Opção 3: Usando domain_id no body**

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "domain_id": "uuid-do-dominio",
  "email": "usuario@example.com",
  "password": "SenhaSegura123!@#"
}'
```

**Resposta esperada (200) - Sem MFA:**
```json
{
  "mfa_required": false,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Resposta esperada (200) - Com MFA Habilitado:**
```json
{
  "mfa_required": true,
  "mfa_token": "temp_token_abc123",
  "available_methods": ["totp", "sms", "email"],
  "message": "MFA é necessário para completar o login"
}
```

**Rate Limit:** 5 tentativas por 15 minutos

---

### 1.3 Verificar Código MFA (POST /auth/mfa-challenge)

**Não requer Domain Context** - Verifica código MFA após login inicial.

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/mfa-challenge' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "mfa_token": "temp_token_abc123",
  "code": "123456",
  "method": "totp"
}'
```

**Resposta esperada (200):**
```json
{
  "mfa_required": false,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Rate Limit:** 3 tentativas por 10 minutos

---

### 1.4 Refresh Token (POST /auth/refresh)

**Requer Domain Context** - Renova o access token usando refresh token.

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/refresh' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}'
```

**Resposta esperada (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Rate Limit:** 10 tentativas por minuto

---

### 1.5 Logout (POST /auth/logout)

**Requer Autenticação JWT e Domain Context** - Revoga tokens do usuário.

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/logout' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}'
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

**Nota:** Se `refresh_token` não for fornecido, todos os tokens do usuário serão revogados.

---

## 2. Recuperação de Senha

### 2.1 Solicitar Reset de Senha (POST /auth/password/forgot)

**Requer Domain Context** - Envia email com link de recuperação de senha.

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/password/forgot' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "email": "usuario@example.com"
}'
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "message": "Se o e-mail existir, um link de recuperação será enviado."
}
```

**Rate Limit:** 3 tentativas por hora

---

### 2.2 Redefinir Senha (POST /auth/password/reset)

**Requer Domain Context** - Redefine a senha usando o token recebido por email.

```bash
curl -X 'POST' \
  'http://localhost:3000/auth/password/reset' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "token": "token_recebido_por_email",
  "new_password": "NovaSenhaSegura123!@#"
}'
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "message": "Senha redefinida com sucesso"
}
```

**Rate Limit:** 5 tentativas por minuto

---

## 3. Gerenciamento de Usuários

### 3.1 Obter Informações do Usuário Autenticado (GET /users/me)

**Requer Autenticação JWT e Domain Context** - Retorna informações do usuário com roles e permissões.

```bash
curl -X 'GET' \
  'http://localhost:3000/users/me' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-domain-slug: unite-group'
```

**Resposta esperada (200):**
```json
{
  "id": "uuid-do-usuario",
  "domain_id": "uuid-do-dominio",
  "email": "usuario@example.com",
  "full_name": "João Silva",
  "phone": "+5511999999999",
  "is_active": true,
  "is_verified": true,
  "mfa_enabled": true,
  "last_login_at": "2026-01-22T12:00:00.000Z",
  "created_at": "2026-01-22T10:00:00.000Z",
  "updated_at": "2026-01-22T12:00:00.000Z",
  "roles": ["admin", "editor"],
  "permissions": ["users:read", "users:write", "domains:read"]
}
```

---

### 3.2 Obter Usuário por ID (GET /users/:id)

**Requer Autenticação JWT, Domain Context e Permissões** - Retorna informações de um usuário específico.

```bash
curl -X 'GET' \
  'http://localhost:3000/users/uuid-do-usuario' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-domain-slug: unite-group'
```

**Resposta esperada (200):**
```json
{
  "id": "uuid-do-usuario",
  "domain_id": "uuid-do-dominio",
  "email": "usuario@example.com",
  "full_name": "João Silva",
  "phone": "+5511999999999",
  "is_active": true,
  "is_verified": true,
  "mfa_enabled": false,
  "last_login_at": "2026-01-22T12:00:00.000Z",
  "created_at": "2026-01-22T10:00:00.000Z",
  "updated_at": "2026-01-22T12:00:00.000Z"
}
```

**Nota:** Requer role `admin` ou `editor` e permissão `users:read`.

---

## 4. MFA (Multi-Factor Authentication)

### 4.1 Configurar MFA (POST /mfa/setup)

**Requer Autenticação JWT e Domain Context** - Configura MFA para o usuário autenticado.

```bash
curl -X 'POST' \
  'http://localhost:3000/mfa/setup' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "method": "totp"
}'
```

**Resposta esperada (200):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "backup_codes": ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", "M3N4O5P6", "Q7R8S9T0", "U1V2W3X4", "Y5Z6A7B8", "C9D0E1F2", "G3H4I5J6", "K7L8M9N0"]
}
```

**Métodos disponíveis:**
- `totp` - Time-based One-Time Password (Google Authenticator, Authy, etc.)
- `sms` - SMS (requer telefone configurado)
- `email` - Email

**Rate Limit:** 5 tentativas por minuto

---

### 4.2 Verificar e Habilitar MFA (POST /mfa/verify)

**Requer Autenticação JWT e Domain Context** - Verifica código MFA e habilita MFA.

```bash
curl -X 'POST' \
  'http://localhost:3000/mfa/verify' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "code": "123456",
  "method": "totp"
}'
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "message": "MFA habilitado com sucesso"
}
```

**Rate Limit:** 3 tentativas por 10 minutos

---

### 4.3 Enviar Código MFA (POST /mfa/send-code)

**Requer Autenticação JWT e Domain Context** - Envia código MFA via SMS ou Email.

```bash
curl -X 'POST' \
  'http://localhost:3000/mfa/send-code' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "method": "sms"
}'
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "message": "Código enviado via sms",
  "expiresIn": 300
}
```

**Métodos disponíveis:** `sms`, `email`

**Rate Limit:** 5 tentativas por minuto

---

### 4.4 Desabilitar MFA (POST /mfa/disable)

**Requer Autenticação JWT e Domain Context** - Desabilita MFA para o usuário autenticado.

```bash
curl -X 'POST' \
  'http://localhost:3000/mfa/disable' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-domain-slug: unite-group'
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "message": "MFA desabilitado com sucesso"
}
```

**Rate Limit:** 2 tentativas por dia

---

### 4.5 Gerar Novos Códigos de Backup (GET /mfa/backup-codes)

**Requer Autenticação JWT e Domain Context** - Gera novos códigos de backup MFA.

```bash
curl -X 'GET' \
  'http://localhost:3000/mfa/backup-codes' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-domain-slug: unite-group'
```

**Resposta esperada (200):**
```json
{
  "backup_codes": ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", "M3N4O5P6", "Q7R8S9T0", "U1V2W3X4", "Y5Z6A7B8", "C9D0E1F2", "G3H4I5J6", "K7L8M9N0"]
}
```

**Rate Limit:** 3 tentativas por hora

---

## 5. SSO (Single Sign-On)

### 5.1 Iniciar Autenticação Google (GET /auth/sso/google)

**Não requer Domain Context** - Inicia o fluxo OAuth2 com Google.

```bash
curl -X 'GET' \
  'http://localhost:3000/auth/sso/google?domain_id=uuid-do-dominio' \
  -H 'accept: application/json'
```

**Resposta esperada (200):**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "random_state_token"
}
```

**Nota:** O `domain_id` é opcional. Se não fornecido, será descoberto automaticamente via domínio do email do Google.

---

### 5.2 Callback Google OAuth (GET /auth/sso/google/callback)

**Não requer Domain Context** - Callback após autenticação Google.

```bash
curl -X 'GET' \
  'http://localhost:3000/auth/sso/google/callback?code=AUTHORIZATION_CODE&state=STATE_TOKEN' \
  -H 'accept: application/json'
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "message": "Autenticação Google realizada com sucesso"
}
```

**Nota:** Em produção, este endpoint normalmente redireciona para o frontend com os tokens na URL ou via POST.

---

## Fluxo Completo de Exemplo

### Cenário 1: Registro e Login Básico

```bash
# 1. Criar domínio (se ainda não existir)
curl -X 'POST' \
  'http://localhost:3000/domains' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Minha Empresa", "slug": "minha-empresa"}'

# 2. Registrar novo usuário
curl -X 'POST' \
  'http://localhost:3000/auth/register' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: minha-empresa' \
  -d '{
    "email": "usuario@example.com",
    "password": "SenhaSegura123!@#",
    "full_name": "João Silva"
  }'

# 3. Fazer login
curl -X 'POST' \
  'http://localhost:3000/auth/login' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: minha-empresa' \
  -d '{
    "email": "usuario@example.com",
    "password": "SenhaSegura123!@#"
  }'

# Salve o access_token retornado para usar nas próximas requisições
```

### Cenário 2: Configurar MFA TOTP

```bash
# 1. Configurar MFA (requer autenticação)
curl -X 'POST' \
  'http://localhost:3000/mfa/setup' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_ACCESS_TOKEN' \
  -H 'x-domain-slug: minha-empresa' \
  -d '{"method": "totp"}'

# 2. Escanear QR code retornado com app autenticador (Google Authenticator, Authy, etc.)

# 3. Verificar código do app autenticador
curl -X 'POST' \
  'http://localhost:3000/mfa/verify' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_ACCESS_TOKEN' \
  -H 'x-domain-slug: minha-empresa' \
  -d '{
    "code": "123456",
    "method": "totp"
  }'

# 4. Agora o login requerirá MFA
```

### Cenário 3: Login com MFA Habilitado

```bash
# 1. Fazer login inicial
curl -X 'POST' \
  'http://localhost:3000/auth/login' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: minha-empresa' \
  -d '{
    "email": "usuario@example.com",
    "password": "SenhaSegura123!@#"
  }'

# Resposta retornará mfa_token e available_methods

# 2. Verificar código MFA
curl -X 'POST' \
  'http://localhost:3000/auth/mfa-challenge' \
  -H 'Content-Type: application/json' \
  -d '{
    "mfa_token": "temp_token_recebido",
    "code": "123456",
    "method": "totp"
  }'

# Resposta retornará access_token e refresh_token
```

### Cenário 4: Recuperação de Senha

```bash
# 1. Solicitar reset de senha
curl -X 'POST' \
  'http://localhost:3000/auth/password/forgot' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: minha-empresa' \
  -d '{"email": "usuario@example.com"}'

# 2. Verificar email e copiar o token do link

# 3. Redefinir senha
curl -X 'POST' \
  'http://localhost:3000/auth/password/reset' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: minha-empresa' \
  -d '{
    "token": "token_do_email",
    "new_password": "NovaSenhaSegura123!@#"
  }'
```

### Cenário 5: SSO Google

```bash
# 1. Obter URL de autenticação Google
curl -X 'GET' \
  'http://localhost:3000/auth/sso/google?domain_id=uuid-do-dominio'

# 2. Abrir authUrl no navegador e autorizar

# 3. Após autorização, Google redireciona para:
# http://localhost:3000/auth/sso/google/callback?code=CODE&state=STATE

# 4. O callback retorna tokens JWT automaticamente
```

---

## Notas Importantes

1. **Autenticação JWT:**
   - Use o header `Authorization: Bearer <access_token>` em todas as requisições protegidas
   - O access token expira em 1 hora (padrão)
   - Use o refresh token para obter novos access tokens

2. **Domain Context:**
   - Todos os endpoints requerem Domain Context (exceto SSO callbacks)
   - Use `x-domain-slug` quando possível (mais amigável)
   - O `domain_id` do token JWT deve corresponder ao Domain Context da requisição

3. **MFA:**
   - MFA é opcional, mas recomendado para segurança
   - TOTP é o método mais comum (Google Authenticator, Authy, etc.)
   - Códigos de backup devem ser armazenados em local seguro
   - Cada código de backup só pode ser usado uma vez

4. **Rate Limiting:**
   - Cada endpoint tem limites específicos de rate limiting
   - Limites são aplicados por domínio
   - Em desenvolvimento, use `./scripts/clear-throttler.sh` para limpar limites

5. **Segurança:**
   - Senhas devem ter mínimo de 8 caracteres (recomendado: 12+)
   - Use HTTPS em produção
   - Tokens devem ser armazenados de forma segura no frontend
   - Não exponha refresh tokens em logs ou URLs

---

## Erros Comuns

### Erro: Domain context is required

**Causa:** Não foi fornecido `x-domain-id` ou `x-domain-slug` header.

**Solução:** Adicione um dos headers mencionados acima.

### Erro: Unauthorized (401)

**Causas possíveis:**
- Token JWT inválido ou expirado
- Token não corresponde ao Domain Context
- Usuário inativo ou domínio inativo

**Solução:** 
- Verifique se o token está correto e não expirou
- Use `/auth/refresh` para renovar o token
- Verifique se o usuário e domínio estão ativos

### Erro: MFA required

**Causa:** Usuário tem MFA habilitado mas não forneceu código.

**Solução:** Use `/auth/mfa-challenge` com o `mfa_token` recebido no login.

### Erro: Código MFA inválido

**Causas possíveis:**
- Código expirado (TOTP: 30 segundos, SMS/Email: 5 minutos)
- Código incorreto
- Método MFA diferente do configurado

**Solução:** 
- Verifique o código no app autenticador
- Use códigos de backup se disponível
- Solicite novo código via `/mfa/send-code` se necessário

### Erro: ThrottlerException: Too Many Requests (429)

**Causa:** Limite de rate limiting atingido.

**Solução:** 
- Aguarde o período de TTL configurado
- Em desenvolvimento, limpe as chaves do Redis: `./scripts/clear-throttler.sh`
- Verifique os limites configurados para cada endpoint

---

## Limites de Rate Limiting Configurados

- **Register:** 3 tentativas/hora
- **Login:** 5 tentativas/15 minutos
- **MFA Challenge:** 3 tentativas/10 minutos
- **Refresh Token:** 10 tentativas/minuto
- **Forgot Password:** 3 tentativas/hora
- **Reset Password:** 5 tentativas/minuto
- **MFA Setup:** 5 tentativas/minuto
- **MFA Verify:** 3 tentativas/10 minutos
- **MFA Send Code:** 5 tentativas/minuto
- **MFA Disable:** 2 tentativas/dia
- **MFA Backup Codes:** 3 tentativas/hora

---

## Variáveis de Ambiente Necessárias

Certifique-se de configurar as seguintes variáveis no arquivo `.env`:

```bash
# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_ACCESS_TOKEN_EXPIRES_IN=1h
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# Password
BCRYPT_ROUNDS=10
PASSWORD_RESET_TOKEN_EXPIRES_IN=30m

# MFA
MFA_ISSUER=Une.cx
ENCRYPTION_KEY=64-character-hex-key-for-aes-encryption

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/sso/google/callback

# SendGrid (Email)
SENDGRID_API_KEY=your-sendgrid-key
EMAIL_FROM=noreply@une.cx
EMAIL_FROM_NAME=Une.cx

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+15551234567
```
