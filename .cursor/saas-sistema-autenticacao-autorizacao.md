# SISTEMA DE AUTENTICAÇÃO E AUTORIZAÇÃO  

## UNE.CX  

  

**Documentação Técnica**    

**Versão 1.0**    

**Janeiro de 2026**  

  

---  

  

## ÍNDICE  

  

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)  

2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)  

3. [Stack Tecnológica Recomendada](#3-stack-tecnológica-recomendada)  

4. [Modelo de Dados](#4-modelo-de-dados)  

5. [Endpoints da API](#5-endpoints-da-api)  

6. [Fluxos de Autenticação Detalhados](#6-fluxos-de-autenticação-detalhados)  

7. [Requisitos de Segurança](#7-requisitos-de-segurança)  

8. [Auditoria e Monitoramento](#8-auditoria-e-monitoramento)  

9. [Variáveis de Ambiente](#9-variáveis-de-ambiente)  

10. [Checklist de Implementação](#10-checklist-de-implementação)  

11. [Próximos Passos e Considerações](#11-próximos-passos-e-considerações)  

  

---  

  

## 1. VISÃO GERAL DO SISTEMA  

  

Este documento descreve a arquitetura e implementação do **Sistema de Autenticação e Autorização da Une.cx**, que servirá como **camada de segurança centralizada** para todos os produtos da empresa.  

  

### 1.1 Objetivos do Sistema  

  

- ✅ Fornecer autenticação centralizada e segura para todos os produtos Une.cx  

- ✅ Implementar autenticação multifator (MFA) obrigatória  

- ✅ Suportar SSO (Single Sign-On) com Microsoft e Google  

- ✅ Garantir auditoria completa e rastreabilidade de ações  

- ✅ Detectar e prevenir acessos não autorizados e ataques de força bruta  

- ✅ Recuperação segura de senhas  

- ✅ **Suportar multi-tenancy com isolamento de dados por Domain (Organização)**  

- ✅ **Implementar RBAC (Role-Based Access Control) por Domain**  

  

### 1.2 Produtos que Utilizarão o Sistema  

  

- **Portal de Agentes**  

- **Casa Une**  

- **Novos produtos em desenvolvimento**  

  

---  

  

## 2. ARQUITETURA DO SISTEMA

### 2.1 Modelo Multi-Tenancy

**Hierarquia de Isolamento:**

```
Domain/Organização
├─ user_1
├─ user_2
├─ user_n
└─ Dados isolados (sessions, audit_logs, roles)
```

O sistema implementa **Hard Isolation** para dados de domínios:
- Cada domínio possui seus próprios usuários, sessões e logs
- Chaves estrangeiras `domain_id` garantem isolamento de dados
- Índices em `domain_id` otimizam consultas com escopo de domínio
- Usuários pertencem a **exatamente um domínio** (relação 1:N domain → users)
- Autenticação requer contexto de domínio (`domain_id` ou `domain_slug`)

**Implicações de Segurança:**
- Queries sempre filtradas por `domain_id` (defense in depth)
- Tokens JWT contêm `domain_id` para validação de escopo
- Rate limiting aplicado por domínio (evita abuso em múltiplos domínios)
- Auditoria e anomalias rastreadas com escopo de domínio
- Papéis (roles) definidos por domínio (admin, user, editor, etc)

### 2.2 Diagrama de Componentes  

  

O sistema é composto por **10 camadas principais**:  

  

| Camada | Descrição |  
|--------|-----------|  
| **Cliente (Frontend)** | Interfaces de usuário: telas de login, cadastro, MFA, recuperação de senha |  
| **API Gateway** | Ponto de entrada único, middleware de autenticação, rate limiter, domain context |  
| **Domain Manager** | Gerenciamento de domínios/organizações (CRUD, configurações, membros) |  
| **Auth Service** | Gerenciamento de tokens JWT, sessões, validação com escopo de domínio |  
| **RBAC Service** | Controle de papéis (roles/permissions) por domínio |  
| **MFA Service** | TOTP, SMS, Email, códigos de backup |  
| **SSO Providers** | Microsoft Identity Platform, Google OAuth 2.0 (com domain discovery) |  
| **Auditoria** | Logs imutáveis com escopo de domínio, detecção de anomalias, alertas |  
| **Armazenamento** | Banco de usuários, Redis (tokens/sessões), políticas de senha, RBAC |  
| **Notificações** | Email, SMS, Push notifications |  


### 2.3 Fluxo de Alto Nível  

```
┌─────────────┐  
│   Cliente   │  
└──────┬──────┘  
       │  
       ▼  
┌──────────────────────────────┐  
│ API Gateway + Domain Context │  
│ (valida domain_id/slug)      │  
└──────┬───────────────────────┘  
       │  
       ├────────────┬──────────────┬─────────────┤  
       │            │              │             │  
       ▼            ▼              ▼             ▼  
┌──────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  
│ Auth Service │ │Domain      │ │RBAC Service│ │ MFA Service  │  
│(domain_id)   │ │Manager     │ │(per domain)│ │              │  
└──────┬───────┘ │(CRUD)      │ └────────────┘ └──────────────┘  
       │         └────────────┘                       
       ├─────────────────────────────────────┤  
       │                                     │  
       ▼                                     ▼  
┌──────────────────┐          ┌──────────────────────┐  
│Rate Limiter      │          │ Anomaly Detector     │  
│(per domain)      │          │ (per domain scope)   │  
└──────────────────┘          └──────────────────────┘  
       │                                     │  
       └─────────────────────────┬───────────┘  
                                 │  
                                 ▼  
                    ┌────────────────────────────┐  
                    │ Database (Hard Isolation)  │  
                    │ domain_id in all tables    │  
                    └────────────────────────────┘  
```  

## 3. STACK TECNOLÓGICA RECOMENDADA  

  

### 3.1 Backend  

  

| Componente | Tecnologia Recomendada |  
|-----------|------------------------|  
| **Runtime** | Node.js 20+ ou Python 3.11+ |  
| **Framework** | Express.js / Fastify (Node) ou FastAPI (Python) |  
| **API Gateway** | Kong ou AWS API Gateway |  
| **Autenticação** | Passport.js (Node) ou Authlib (Python) |  
| **JWT** | jsonwebtoken (Node) ou PyJWT (Python) |  
| **Hash de Senhas** | bcrypt ou Argon2 |  
| **MFA - TOTP** | speakeasy (Node) ou pyotp (Python) |  
  

### 3.2 Banco de Dados e Cache  


| Componente | Tecnologia |  
|-----------|-----------|  
| **Banco Principal** | PostgreSQL 15+ ou MySQL 8+ |  
| **Cache/Sessões** | Redis 7+ |  
| **ORM** | Prisma (Node) ou SQLAlchemy (Python) |  


### 3.3 Serviços Externos  

  

| Serviço | Provider Recomendado |  
|---------|---------------------|  
| **Email** | SendGrid, AWS SES ou Resend |  
| **SMS** | Twilio ou AWS SNS |  
| **Monitoramento** | Sentry, DataDog ou New Relic |  
| **Logs** | ELK Stack ou CloudWatch Logs |  


---  

  

## 4. MODELO DE DADOS  

  

### 4.1 Entidades Principais - Domain Multi-Tenancy

#### Tabela: `domains` (NOVO)

```sql  

CREATE TABLE domains (  

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  

    name VARCHAR(255) NOT NULL,  

    slug VARCHAR(255) UNIQUE NOT NULL,  

    description TEXT,  

    is_active BOOLEAN DEFAULT TRUE,  

    created_by UUID NOT NULL,  

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  

);  

  

CREATE INDEX idx_domains_slug ON domains(slug);  

CREATE INDEX idx_domains_active ON domains(is_active);  

```

**Propósito:** Armazena informações sobre domínios/organizações. Cada domínio é um tenant isolado com seus próprios usuários.

---

#### Tabela: `users` (MODIFICADA)  

  

```sql  

CREATE TABLE users (  

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  

    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,  

    email VARCHAR(255) NOT NULL,  

    password_hash VARCHAR(255),  

    full_name VARCHAR(255),  

    phone VARCHAR(20),  

    is_active BOOLEAN DEFAULT TRUE,  

    is_verified BOOLEAN DEFAULT FALSE,  

    mfa_enabled BOOLEAN DEFAULT FALSE,  

    last_login_at TIMESTAMP,  

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  

    UNIQUE(domain_id, email)  

);  

  

CREATE INDEX idx_users_domain_id ON users(domain_id);  

CREATE INDEX idx_users_email_domain ON users(domain_id, email);  

CREATE INDEX idx_users_active ON users(is_active);  

```

**Mudanças:**
- ✅ Adicionado `domain_id` (FK) - cada usuário pertence a exatamente um domínio
- ✅ Email único **por domínio** (constraint UNIQUE composto)
- ✅ Índice composto `(domain_id, email)` para otimizar buscas

---

#### Tabela: `domain_roles` (NOVO)

```sql

CREATE TABLE domain_roles (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,

    description TEXT,

    permissions TEXT[], -- Array de permissões (ex: ['users:read', 'users:write'])

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(domain_id, name)

);

CREATE INDEX idx_domain_roles_domain_id ON domain_roles(domain_id);

```

**Propósito:** Define papéis (roles) disponíveis em cada domínio (admin, editor, viewer, etc).

---

#### Tabela: `user_roles` (NOVO)

```sql

CREATE TABLE user_roles (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    role_id UUID NOT NULL REFERENCES domain_roles(id) ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

```

**Propósito:** Associa usuários aos papéis em um domínio (relação N:M).

---

```sql  

CREATE TABLE user_mfa (  

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  

    mfa_type VARCHAR(20) NOT NULL, -- 'totp', 'sms', 'email'  

    secret VARCHAR(255) NOT NULL, -- Criptografado  

    backup_codes TEXT[], -- Criptografados  

    is_primary BOOLEAN DEFAULT FALSE,  

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  

);  

  

CREATE INDEX idx_user_mfa_user_id ON user_mfa(user_id);  

```  

#### Tabela: `sessions` (MODIFICADA)
```sql  

CREATE TABLE sessions (  

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  

    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,  

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  

    token VARCHAR(500) UNIQUE NOT NULL,  

    ip_address VARCHAR(45),  

    user_agent TEXT,  

    expires_at TIMESTAMP NOT NULL,  

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  

);  

  

CREATE INDEX idx_sessions_domain_id ON sessions(domain_id);  

CREATE INDEX idx_sessions_user_id ON sessions(user_id);  

CREATE INDEX idx_sessions_token ON sessions(token);  

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);  

```

**Mudanças:**
- ✅ Adicionado `domain_id` para rastreamento de escopo
- ✅ Índice em `domain_id` para queries eficientes

  

```sql  

CREATE TABLE password_reset_tokens (  

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  

    token VARCHAR(255) UNIQUE NOT NULL,  

    expires_at TIMESTAMP NOT NULL,  

    used_at TIMESTAMP NULL,  

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  

);  

  

CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token);  

CREATE INDEX idx_reset_tokens_user_id ON password_reset_tokens(user_id);  

```  

  

#### Tabela: `audit_logs` (MODIFICADA)

```sql  

CREATE TABLE audit_logs (  

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  

    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,  

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,  

    event_type VARCHAR(100) NOT NULL,  

    event_data JSONB,  

    ip_address VARCHAR(45),  

    user_agent TEXT,  

    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'  

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  

);  

  

CREATE INDEX idx_audit_logs_domain_id ON audit_logs(domain_id);  

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);  

CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);  

CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);  

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);  

```

**Mudanças:**
- ✅ Adicionado `domain_id` para isolamento de logs por tenant
- ✅ Queries de auditoria sempre filtradas por domínio

```  

  

---  

  

## 5. ENDPOINTS DA API  

### 5.1 Gerenciamento de Domínios (NOVO)

#### **POST** `/domains`  

Criar novo domínio. Requer autenticação de admin.

**Response (201):** Domínio criado com `id`, `name`, `slug`

---

#### **GET** `/domains/:id`  

Obter informações de um domínio

**Response (200):** Detalhes do domínio com user_count

---

#### **PUT** `/domains/:id`  

Atualizar domínio

**Response (200):** Domínio atualizado

---

#### **DELETE** `/domains/:id`  

Deletar domínio

**Response (204):** No Content

---

#### **GET** `/domains/:id/users`  

Listar usuários do domínio

**Response (200):** Lista paginada com roles

---

### 5.2 Autenticação Tradicional (MODIFICADA)  

  

#### **POST** `/auth/register`  

  

Cadastro de novo usuário  

  

**Request Body:**  

```json  
{  
  "domain_id": "domain-uuid",  
  "email": "usuario@example.com",  
  "password": "Senha123!@#",  
  "full_name": "Nome Completo",  
  "phone": "+5511999999999"  
}  

```  

  

**Response (201):**  


```  

  

#### **POST** `/auth/login`  

  

Login com credenciais  

  

**Request Body:**  

```json  
{  
  "domain_id": "domain-uuid",  
  "mfa_required": true,  
  "mfa_token": "temp_token_abc123",  
  "available_methods": ["totp", "sms", "email"]  
}  

```  

  

**Response (200) - Sem MFA (primeira vez):**  

```json  
{  
  "mfa_required": false,  
  "setup_required": true,  
  "access_token": "eyJhbGciOiJIUzI1NiIs...",  
  "message": "Configure MFA para aumentar a segurança"  
}  

```  

  

#### **POST** `/auth/mfa/verify`  

  

Validação do código MFA  

  

**Request Body:**  

```json  
{  
  "mfa_token": "temp_token_abc123",  
  "code": "123456",  
  "method": "totp"  
}  

```  

  

**Response (200):**  

```json  
{  
  "access_token": "eyJhbGciOiJIUzI1NiIs...",  
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",  
  "expires_in": 3600,  
  "token_type": "Bearer"  
}  

```  

  

#### **POST** `/auth/mfa/setup`  

  

Configurar MFA pela primeira vez  

  

**Request Body:**  

```json  
{  
  "method": "totp"  
}  

```  

  

**Response (200):**  

```json  
{  
  "secret": "JBSWY3DPEHPK3PXP",  
  "qr_code": "data:image/png;base64,iVBORw0KGg...",  
  "backup_codes": ["12345678", "87654321", ...]  
}  

```  

  

#### **POST** `/auth/refresh`  

  

Renovar access token usando refresh token  

  

**Request Body:**  

```json  
{  
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."  
}  

```  

  

**Response (200):**  

```json  
{  
  "access_token": "eyJhbGciOiJIUzI1NiIs...",  
  "expires_in": 3600  
}  

```  

  

#### **POST** `/auth/logout`  

  

Encerrar sessão  

  

**Headers:**  

```text

Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  

```  

  

**Response (200):**  

```json  
{  
  "success": true,  
  "message": "Logout realizado com sucesso"  
}  

```  

  

---  

  

### 5.2 SSO (Single Sign-On)  

  

#### **GET** `/auth/sso/microsoft`  

  

Inicia fluxo OAuth2 com Microsoft  

  

**Response:** Redirect para Microsoft Identity Platform  

  

#### **GET** `/auth/sso/google`  

  

Inicia fluxo OAuth2 com Google  

  

**Response:** Redirect para Google OAuth  

  

#### **GET** `/auth/sso/callback`  

  

Callback após autenticação SSO  

  

**Query Params:**  

- `code`: authorization_code  

- `state`: random_state  

  

**Response:** Redirect para app com tokens  

  

---  

  

### 5.3 Recuperação de Senha  

  

#### **POST** `/auth/password/forgot`  

  

Solicita reset de senha  

  

**Request Body:**  

```json  
{  
  "email": "usuario@example.com"  
}  

```  

  

**Response (200):**  

```json  
{  
  "success": true,  
  "message": "Email de recuperação enviado"  
}  

```  

  

#### **POST** `/auth/password/reset`  

  

Redefine senha com token  

  

**Request Body:**  

```json  
{  
  "token": "reset_token_xyz",  
  "new_password": "NovaSenha123!@#"  
}  

```  

  

**Response (200):**  

```json  
{  
  "success": true,  
  "message": "Senha redefinida com sucesso"  
}  

```  

  

---  

  

### 5.4 Gerenciamento de Conta  

  

#### **GET** `/auth/me`  

  

Obter informações do usuário autenticado  

  

**Headers:**  

```text

Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  

```  

  

**Response (200):**  

```json  
{  
  "id": "uuid-123",  
  "email": "usuario@example.com",  
  "full_name": "Nome Completo",  
  "mfa_enabled": true,  
  "is_verified": true  
}  

```  

  

#### **PUT** `/auth/me`  

  

Atualizar informações do usuário  

  

**Request Body:**  

```json  
{  
  "full_name": "Novo Nome",  
  "phone": "+5511999999999"  
}  

```  

  

#### **POST** `/auth/password/change`  

  

Alterar senha (usuário autenticado)  

  

**Request Body:**  

```json  
{  
  "current_password": "SenhaAtual123!",  
  "new_password": "NovaSenha456!@#"  
}  

```  

  

---  

  

## 6. FLUXOS DE AUTENTICAÇÃO DETALHADOS  

  

### 6.1 Fluxo de Login com MFA  

  

```text 

1. Usuário envia email e senha para /auth/login  
   ↓  
2. Backend valida credenciais no banco de dados  
   ↓  
3. Se credenciais válidas, verifica se MFA está habilitado  
   ↓  
4. Se MFA habilitado:  
   ├─ Gera token temporário (15 minutos)  
   ├─ Retorna mfa_required: true e mfa_token  
   └─ Frontend exibe tela de MFA  
   ↓  
5. Usuário seleciona método MFA (TOTP/SMS/Email)  
   ↓  
6. Se SMS ou Email: backend envia código  
   ↓  
7. Usuário insere código e envia para /auth/mfa/verify  
   ↓  
8. Backend valida código  
   ↓  
9. Se válido: gera JWT com expiração de 1 hora  
   ↓  
10. Retorna access_token e refresh_token  
    ↓  
11. Registra evento no audit_log  

```  

  

### 6.2 Fluxo de SSO  

  

```text
1. Usuário clica em "Login com Microsoft/Google"  
   ↓  
2. Frontend redireciona para /auth/sso/microsoft ou /auth/sso/google  
   ↓  
3. Backend gera state aleatório e redireciona para provedor SSO  
   ↓  
4. Usuário autentica no provedor  
   ↓  
5. Provedor redireciona para /auth/sso/callback com código  
   ↓  
6. Backend valida state e troca código por access_token  
   ↓  
7. Backend busca informações do usuário no provedor  
   ↓  
8. Se usuário não existe: cria conta automaticamente  
   ↓  
9. Gera JWT próprio da aplicação  
   ↓  
10. Redireciona para frontend com tokens  
```  

  

### 6.3 Fluxo de Recuperação de Senha  

  

```text
1. Usuário clica em "Esqueci minha senha"  
   ↓  
2. Usuário informa email em /auth/password/forgot  
   ↓  
3. Backend verifica se email existe  
   ↓  
4. Gera token único com expiração de 30 minutos  
   ↓  
5. Salva token no banco (password_reset_tokens)  
   ↓  
6. Envia email com link: https://app.une.cx/reset?token=xyz  
   ↓  
7. Usuário clica no link  
   ↓  
8. Frontend exibe formulário de nova senha  
   ↓  
9. Usuário envia nova senha + token para /auth/password/reset  
   ↓  
10. Backend valida token (não expirado, não usado)  
    ↓  
11. Atualiza senha do usuário  
    ↓  
12. Marca token como usado (used_at)  
    ↓  
13. Registra evento no audit_log  
    ↓  
14. Envia email de confirmação  

```  

  

---  

  

## 7. REQUISITOS DE SEGURANÇA  

  

### 7.1 Políticas de Senha  

  

✅ **Mínimo 12 caracteres**    

✅ Pelo menos 1 letra maiúscula    

✅ Pelo menos 1 letra minúscula    

✅ Pelo menos 1 número    

✅ Pelo menos 1 caractere especial    

✅ Não permitir senhas comuns (usar lista de senhas vazadas - HaveIBeenPwned API)    

✅ Histórico de últimas 5 senhas (não permitir reutilização)    

  

**Exemplo de validação em Node.js:**  

  

```javascript  
const passwordSchema = new passwordValidator();  
passwordSchema  
  .is().min(12)  
  .has().uppercase()  
  .has().lowercase()  
  .has().digits()  
  .has().symbols()  
  .is().not().oneOf(['Password123!', 'Admin123!']); // Lista de senhas comuns  
```  

  

### 7.2 Rate Limiting (ATUALIZADO PARA DOMAIN-SCOPED)

| Endpoint | Limite | Janela | Escopo | Ação ao Exceder |  
|----------|--------|--------|--------|-----------------|  
| `/auth/login` | 5 tentativas | 15 minutos | **Por domínio + email** | Bloqueio temporário + CAPTCHA |  
| `/auth/mfa/verify` | 3 tentativas | 10 minutos | **Por domínio + usuário** | Invalidar mfa_token |  
| `/auth/password/forgot` | 3 tentativas | 1 hora | **Por domínio + email** | Bloqueio temporário |  
| `/auth/register` | 3 tentativas | 1 hora | **Por domínio + IP** | Bloqueio por IP |  
| `/domains/:id/users` | 100 req | 1 minuto | **Por domínio** | HTTP 429 |  

**Implementação com Redis (Domain-Scoped):**  

```javascript  
const rateLimit = require('express-rate-limit');  
const RedisStore = require('rate-limit-redis');  

// Rate limit por domínio + email
const loginLimiter = rateLimit({  
  store: new RedisStore({  
    client: redisClient,  
    prefix: 'rl:login:'  
  }),  
  keyGenerator: (req, res) => {  
    // Chave inclui domínio para isolamento
    return `${req.body.domain_id}:${req.body.email}`;  
  },  
  windowMs: 15 * 60 * 1000,  
  max: 5,  
  message: 'Muitas tentativas neste domínio. Tente novamente em 15 minutos.'  
});  

```  

  

### 7.3 Tokens JWT (ATUALIZADO PARA DOMAIN)

**Configuração:**  
- **Access Token**: expiração de 1 hora  
- **Refresh Token**: expiração de 7 dias  
- **Algoritmo**: RS256 (chave assimétrica)  
- **Payload**: `user_id`, `email`, `domain_id`, `roles`, `iat`, `exp`  
- **Blacklist**: tokens revogados armazenados no Redis  

  

**Estrutura do Payload (ATUALIZADA):**  
  

```json  
{  
  "user_id": "uuid-123",  
  "email": "usuario@example.com",  
  "domain_id": "domain-uuid",  
  "domain_slug": "minha-org",  
  "roles": ["admin", "user"],  
  "permissions": ["users:read", "users:write"],  
  "iat": 1704067200,  
  "exp": 1704070800  
}  

```  

**Implicações de Segurança:**
- ✅ `domain_id` permite validar o escopo da requisição
- ✅ `domain_slug` facilita auditar por qual domínio foi feito o acesso
- ✅ `roles` e `permissions` incluem RBAC do domínio
- ✅ Middleware valida que `domain_id` no token corresponde ao `domain_id` da requisição

  

**Geração de Chaves RSA:**  

  

```bash  
# Gerar chave privada  
openssl genrsa -out private.pem 2048  
  

# Extrair chave pública  
openssl rsa -in private.pem -pubout -out public.pem  

```  

  

### 7.4 MFA - Autenticação Multifator  

  

#### Métodos Suportados:  

  

1. **TOTP (Time-based One-Time Password)**  

   - Google Authenticator, Microsoft Authenticator  

   - Código de 6 dígitos válido por 30 segundos  

   - Secret criptografado no banco  

  

2. **SMS**  

   - Código de 6 dígitos  

   - Validade: 5 minutos  

   - Provider: Twilio ou AWS SNS  

  

3. **Email**  

   - Código de 6 dígitos  

   - Validade: 5 minutos  

   - Provider: SendGrid ou AWS SES  

  

4. **Backup Codes**  

   - 10 códigos únicos de 8 dígitos  

   - Uso único  

   - Criptografados no banco  

  

#### Configuração:  

  

✅ MFA obrigatório após o primeiro login    

✅ Permitir múltiplos métodos configurados    

✅ Secrets TOTP criptografados no banco    

✅ Gerar QR Code para TOTP no setup    

✅ Notificar por email quando MFA é desabilitado    

  

**Exemplo de Setup TOTP:**  

  

```javascript  
const speakeasy = require('speakeasy');  
const QRCode = require('qrcode');  

// Gerar secret  
const secret = speakeasy.generateSecret({  
  name: 'Une.cx (usuario@example.com)'  
});  

  

// Gerar QR Code  

const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);  

  

// Salvar secret criptografado no banco  

await saveMFASecret(userId, encrypt(secret.base32));  

```  

  

### 7.5 Criptografia de Dados Sensíveis  

  

**Dados que devem ser criptografados:**  

- Secrets TOTP  

- Backup codes MFA  

- Tokens de reset de senha (hash)  

  

**Algoritmo recomendado:** AES-256-GCM  

  

```javascript  
const crypto = require('crypto');   

function encrypt(text) {  
  const algorithm = 'aes-256-gcm';  
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');  

  const iv = crypto.randomBytes(16); 
   
  const cipher = crypto.createCipheriv(algorithm, key, iv);  
  let encrypted = cipher.update(text, 'utf8', 'hex');  
  encrypted += cipher.final('hex');    

  const authTag = cipher.getAuthTag();    

  return {  
    encrypted,  
    iv: iv.toString('hex'),  
    authTag: authTag.toString('hex')  
  };  
}  

```  

  

---  

  

## 8. AUDITORIA E MONITORAMENTO (DOMAIN-SCOPED)

### 8.1 Eventos de Auditoria  

  

Todos os eventos devem ser registrados na tabela `audit_logs` **com escopo de domínio**:  

  

| Evento | Severidade | Alerta | Notificação | Domain-Scoped |  
|--------|-----------|--------|-------------|---|  
| Login bem-sucedido | info | Não | Não | ✅ |  
| Falha de login | warning | 3+ falhas/domínio | Email se > 5 falhas | ✅ |  
| Falha MFA | critical | Sim | Email + SMS | ✅ |  
| Alteração de senha | info | Não | Email | ✅ |  
| Login de novo IP | warning | Não | Email | ✅ |  
| Login de novo país | warning | Sim | Email + SMS | ✅ |  
| Desativação MFA | critical | Sim | Email + SMS | ✅ |  
| Criação de conta | info | Não | Email boas-vindas | ✅ |  
| Token JWT revogado | warning | Não | Não | ✅ |  
| Múltiplos logins simultâneos | warning | Sim | Email | ✅ |  
| **Alteração de RBAC** | **info** | **Não** | **Email admin** | **✅** |  
| **Acesso negado (403)** | **warning** | **Sim** | **Email** | **✅** |  

**Importante:** Todas as queries de auditoria devem filtrar por `domain_id` para garantir isolamento. Usuários podem ver apenas logs de seu próprio domínio.  
 

### 8.2 Detecção de Anomalias (DOMAIN-SCOPED)

O sistema deve detectar e alertar sobre (com escopo por domínio):  

  

✅ **Múltiplas tentativas de login falhadas** (>5 em 15 min **por domínio**)    

✅ **Login de país/região não usual** (usar GeoIP)    

✅ **Múltiplos logins simultâneos de IPs diferentes** (>3 sessões **por usuário no domínio**)    

✅ **Padrões de acesso suspeitos** (horários incomuns)    

✅ **Tentativas de acesso a recursos não autorizados** (RBAC violation **por domínio**)   

✅ **Mudança repentina de User-Agent**    

✅ **Velocidade impossível** (login de 2 países em <1h)    

✅ **Abuso de rate limit** (excesso de requisições **por domínio**)

**Exemplo de Implementação (Domain-Scoped):**  

  

```javascript  
async function detectAnomalies(domainId, userId, loginData) {  
  // Busca logins recentes APENAS neste domínio
  const recentLogins = await getRecentLogins(domainId, userId, '1 hour'); 
   

  // Verificar múltiplos países neste domínio  
  const countries = new Set(recentLogins.map(l => l.country));  
  if (countries.size > 1) {  
    await createAlert({  
      domain_id: domainId,  
      user_id: userId,  
      type: 'IMPOSSIBLE_TRAVEL',  
      severity: 'critical'  
    });  
  }  
}  

```
   

  // Verificar múltiplos países  

  const countries = new Set(recentLogins.map(l => l.country));  
  if (countries.size > 1) {  
    await createAlert({  
      user_id: userId,  
      type: 'IMPOSSIBLE_TRAVEL',  
      severity: 'critical',  
      data: { countries: Array.from(countries) }  
    });  
  }  

   

  // Verificar múltiplas sessões  

  if (recentLogins.length > 3) {  
    await createAlert({  
      user_id: userId,  
      type: 'MULTIPLE_SESSIONS',  
      severity: 'warning'  
    });  
  }  
}  

```  

  

### 8.3 Dashboard de Auditoria  

  

**Métricas a serem exibidas:**  

  

- Total de logins nas últimas 24h/7d/30d  

- Taxa de sucesso vs falha de login  

- Distribuição geográfica de logins  

- Eventos críticos recentes  

- Usuários com mais tentativas falhas  

- Taxa de adoção de MFA  

- Tempo médio de sessão  

- Alertas de segurança pendentes  

  

---  

  

## 9. VARIÁVEIS DE AMBIENTE  

  

```bash  

# ============================================  
# BANCO DE DADOS  
# ============================================  
DATABASE_URL=postgresql://user:pass@localhost:5432/auth_db  
DATABASE_POOL_SIZE=20  
 

# ============================================  
# REDIS  
# ============================================  

REDIS_URL=redis://localhost:6379  
REDIS_PASSWORD=your-redis-password   

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
MICROSOFT_CLIENT_ID=your-azure-app-id  
MICROSOFT_CLIENT_SECRET=your-azure-secret  
MICROSOFT_TENANT_ID=your-tenant-id (opcional, pode ser 'common' ou 'organizations')  
MICROSOFT_REDIRECT_URI=https://api.une.cx/auth/sso/microsoft/callback  

# ============================================  
# GOOGLE SSO  
# ============================================  
GOOGLE_CLIENT_ID=your-google-client-id  
GOOGLE_CLIENT_SECRET=your-google-secret  
GOOGLE_REDIRECT_URI=https://api.une.cx/auth/sso/google/callback   

# ============================================  
# EMAIL (SENDGRID)  
# ============================================  
SENDGRID_API_KEY=your-sendgrid-key  
EMAIL_FROM=noreply@une.cx  
EMAIL_FROM_NAME=Une.cx    

# ============================================  
# SMS (TWILIO)  
# ============================================  
TWILIO_ACCOUNT_SID=your-twilio-sid  
TWILIO_AUTH_TOKEN=your-twilio-token  
TWILIO_PHONE_NUMBER=+15551234567  
  
# ============================================  
# MFA  
# ============================================  
MFA_ISSUER=Une.cx  
MFA_ENCRYPTION_KEY=32-character-hex-key-for-aes-encryption  
  

# ============================================  
# RATE LIMITING  
# ============================================  
RATE_LIMIT_WINDOW_MS=900000  # 15 minutos  
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
SENTRY_DSN=https://your-sentry-dsn  
LOG_LEVEL=info  
 

# ============================================  
# GERAL  
# ============================================  
NODE_ENV=production  
PORT=3000  
API_BASE_URL=https://api.une.cx  
FRONTEND_URL=https://app.une.cx  
```  

  

---  

  

## 10. CHECKLIST DE IMPLEMENTAÇÃO  

  

### 📋 Fase 1 - Fundação (Sprint 1-2)  

  

- [ ] Setup do projeto (framework, estrutura de pastas)  

- [ ] Configuração do banco de dados PostgreSQL  

- [ ] Configuração do Redis  

- [ ] Criação das migrations do banco  

- [ ] Implementação do modelo User  

- [ ] Hash de senhas com bcrypt/Argon2  

- [ ] Endpoint de registro (`/auth/register`)  

- [ ] Endpoint de login (`/auth/login`)  

- [ ] Geração de JWT  

- [ ] Middleware de autenticação  

- [ ] Validação de tokens JWT  

- [ ] Endpoint `/auth/refresh`  

- [ ] Endpoint `/auth/logout`  

- [ ] Testes unitários básicos  

  

### 📋 Fase 2 - MFA (Sprint 3-4)  

  

- [ ] Implementação de TOTP (speakeasy/pyotp)  

- [ ] Geração de QR Code para TOTP  

- [ ] Implementação de MFA via SMS (Twilio)  

- [ ] Implementação de MFA via Email  

- [ ] Geração de códigos de backup  

- [ ] Endpoint `/auth/mfa/setup`  

- [ ] Endpoint `/auth/mfa/verify`  

- [ ] Criptografia de secrets MFA (AES-256-GCM)  

- [ ] Validação de códigos TOTP  

- [ ] Validação de códigos SMS/Email  

- [ ] Validação de backup codes  

- [ ] Tabela `user_mfa`  

- [ ] Testes de MFA  

  

### 📋 Fase 3 - SSO (Sprint 5)  

  

- [ ] Configuração Microsoft Identity Platform  

- [ ] Configuração Google OAuth 2.0  

- [ ] Endpoint `/auth/sso/microsoft`  

- [ ] Endpoint `/auth/sso/google`  

- [ ] Endpoint `/auth/sso/callback`  

- [ ] Validação de state do OAuth  

- [ ] Troca de código por token  

- [ ] Busca de informações do usuário  

- [ ] Auto-criação de usuários SSO  

- [ ] Vinculação de contas (email existente)  

- [ ] Testes de SSO  

  

### 📋 Fase 4 - Segurança e Auditoria (Sprint 6-7)  

  

- [ ] Implementação de rate limiting (express-rate-limit)  

- [ ] Tabela `audit_logs`  

- [ ] Sistema de logging de eventos  

- [ ] Detecção de anomalias (múltiplas tentativas)  

- [ ] Detecção de login de novo IP/país  

- [ ] Detecção de múltiplas sessões  

- [ ] Sistema de alertas (email/SMS)  

- [ ] Recuperação de senha (`/auth/password/forgot`)  

- [ ] Reset de senha (`/auth/password/reset`)  

- [ ] Tabela `password_reset_tokens`  

- [ ] Notificações por email (SendGrid)  

- [ ] Notificações por SMS (Twilio)  

- [ ] Dashboard de auditoria (admin)  

  

### 📋 Fase 5 - Testes e Deploy (Sprint 8)  

  

- [ ] Testes unitários (cobertura > 80%)  

- [ ] Testes de integração  

- [ ] Testes de segurança (OWASP Top 10)  

- [ ] Testes de carga (Artillery/K6)  

- [ ] Documentação da API (Swagger/OpenAPI)  

- [ ] Setup CI/CD (GitHub Actions/GitLab CI)  

- [ ] Configuração de ambiente staging  

- [ ] Deploy em staging  

- [ ] Testes em staging  

- [ ] Configuração de monitoramento (Sentry/DataDog)  

- [ ] Deploy em produção  

- [ ] Monitoramento pós-deploy  

  

---  

  

## 11. PRÓXIMOS PASSOS E CONSIDERAÇÕES  

  

### 11.1 Após Conclusão do Sistema de Auth  

  

✅ Criar SDK de autenticação para integração nos produtos    

✅ Desenvolver bibliotecas client (JavaScript, React, Vue)    

✅ Documentar processo de integração para novos produtos    

✅ Criar ambiente de sandbox para testes    

✅ Implementar sistema de permissões e roles (RBAC)    

✅ Criar exemplos de integração    

  

### 11.2 Melhorias Futuras  

  

🔮 Suporte a biometria (WebAuthn/FIDO2)    

🔮 Login sem senha (Passwordless)    

🔮 Integração com mais provedores SSO (Apple, LinkedIn)    

🔮 Machine Learning para detecção avançada de fraudes    

🔮 Análise comportamental de usuários    

🔮 Dashboard administrativo completo    

🔮 Suporte a organizações e workspaces    

🔮 API de gestão de usuários para admins    

  

### 11.3 Exemplo de Integração em Produto  

  

**React/Next.js:**  

  

```javascript  
import { useAuth } from '@une.cx/auth-sdk';  
  
function MyApp() {  
  const { user, login, logout, isAuthenticated } = useAuth();     

  if (!isAuthenticated) {  
    return <Login onSubmit={login} />;  
  }    

  return (  
    <div>  
      <h1>Bem-vindo, {user.full_name}!</h1>  
      <button onClick={logout}>Sair</button>  
    </div>  
  );  
}  

```  

  

### 11.4 Contatos e Suporte  

  

**Equipe Une.cx**    

📧 Email: dev@une.cx    

📚 Documentação: https://docs.une.cx/auth    

🔧 GitHub: https://github.com/une-cx/auth-service    

  

---  

  

## APÊNDICE A - Exemplo de Implementação Completa  

  

### Estrutura de Pastas Recomendada  

  

```text 
auth-service/  
├── src/  
│   ├── config/  
│   │   ├── database.js  
│   │   ├── redis.js  
│   │   └── jwt.js  
│   ├── controllers/  
│   │   ├── auth.controller.js  
│   │   ├── mfa.controller.js  
│   │   └── sso.controller.js  
│   ├── services/  
│   │   ├── auth.service.js  
│   │   ├── mfa.service.js  
│   │   ├── email.service.js  
│   │   └── sms.service.js  
│   ├── middlewares/  
│   │   ├── auth.middleware.js  
│   │   ├── rateLimit.middleware.js  
│   │   └── validation.middleware.js  
│   ├── models/  
│   │   ├── user.model.js  
│   │   ├── session.model.js  
│   │   └── auditLog.model.js  
│   ├── routes/  
│   │   ├── auth.routes.js  
│   │   ├── mfa.routes.js  
│   │   └── sso.routes.js  
│   ├── utils/  
│   │   ├── crypto.js  
│   │   ├── jwt.js  
│   │   └── validators.js  
│   └── index.js  
├── tests/  
│   ├── unit/  
│   └── integration/  
├── .env.example  
├── package.json  
└── README.md  

```  

  

---  

  

**Documento gerado em Janeiro de 2026**    

**Une.cx - Sistema de Autenticação Corporativo**    

**Versão 1.0**