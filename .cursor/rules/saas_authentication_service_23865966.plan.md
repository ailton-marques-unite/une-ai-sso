---
name: SaaS Authentication Service
overview: Desenvolvimento de serviço backend SaaS de autenticação baseado na arquitetura Mermaid, implementado em Node.js/TypeScript com abordagem incremental em fases, começando pelo MVP e expandindo para funcionalidades avançadas de MFA, SSO, auditoria e segurança.
todos:
  - id: setup-infrastructure
    content: "Configurar infraestrutura base: Docker Compose, estrutura de projeto TypeScript, configuração de ambiente e logging"
    status: pending
  - id: api-gateway-basic
    content: Implementar API Gateway básico com Express/Fastify, middleware de CORS, roteamento e health checks
    status: pending
    dependencies:
      - setup-infrastructure
  - id: user-service
    content: Criar User Service com registro de usuários, hash de senhas (bcrypt/Argon2) e política de senhas básica
    status: pending
    dependencies:
      - setup-infrastructure
  - id: auth-service-basic
    content: Implementar Auth Service com login, geração de JWT (access + refresh tokens) e rate limiting básico
    status: pending
    dependencies:
      - user-service
      - api-gateway-basic
  - id: password-recovery
    content: Implementar recuperação de senha com tokens temporários armazenados no Redis e envio de email
    status: pending
    dependencies:
      - auth-service-basic
  - id: auth-middleware
    content: Criar middleware de autenticação para validação de JWT em rotas protegidas
    status: pending
    dependencies:
      - auth-service-basic
  - id: mfa-service
    content: Implementar MFA Service com TOTP, geração de QR codes, códigos de backup e criptografia de secrets
    status: pending
    dependencies:
      - auth-service-basic
  - id: sms-email-mfa
    content: Integrar MFA via SMS (Twilio/AWS SNS) e Email com rate limiting
    status: pending
    dependencies:
      - mfa-service
  - id: google-sso
    content: Implementar SSO Google OAuth 2.0 com fluxo completo de callback e criação automática de usuários
    status: pending
    dependencies:
      - auth-service-basic
  - id: audit-service
    content: Criar Audit Service com logging imutável de eventos críticos (login, MFA, password reset, tokens, sessões)
    status: pending
    dependencies:
      - auth-service-basic
  - id: security-monitoring
    content: Implementar Security Monitor e Detector de Anomalias com regras básicas para detecção de padrões suspeitos
    status: pending
    dependencies:
      - audit-service
  - id: alert-system
    content: Criar sistema de alertas integrado com Notification Service para eventos críticos de segurança
    status: pending
    dependencies:
      - security-monitoring
  - id: session-management
    content: Implementar gerenciamento avançado de sessões distribuídas no Redis com revogação
    status: pending
    dependencies:
      - auth-service-basic
  - id: notification-service
    content: Criar Notification Service completo com templates, preferências de usuário e suporte a email, SMS e push
    status: pending
    dependencies:
      - alert-system
  - id: integration-apis
    content: Desenvolver APIs de integração para produtos externos (validação de tokens, webhooks, SDK)
    status: pending
    dependencies:
      - auth-service-basic
      - session-management
  - id: optimization-testing
    content: Otimizar performance (cache, índices, connection pooling) e implementar testes completos (unitários, integração, carga)
    status: pending
    dependencies:
      - integration-apis
      - notification-service
  - id: documentation
    content: Criar documentação OpenAPI/Swagger e guia de deploy para produção
    status: pending
    dependencies:
      - optimization-testing
---

# Plano de Desenvolvimento - Serviço de Autenticação SaaS

## Arquitetura Geral

O serviço será desenvolvido como uma arquitetura de microsserviços modular, seguindo o diagrama Mermaid fornecido. A implementação será em **Node.js/TypeScript** com **Docker** para containerização, permitindo deploy agnóstico de cloud.

## Estrutura do Projeto

```
shared/                     # Código compartilhado
├── types/                  # TypeScript types/interfaces
├── utils/                  # Utilitários compartilhados
├── middleware/             # Middlewares reutilizáveis
users/
├── application/
│   ├── dtos/
│   ├── services/
│   │   ├── auth-service/          # Serviço principal de autenticação
│   │   ├── mfa-service/           # Serviço MFA (TOTP, SMS, Email)
│   │   ├── audit-service/         # Serviço de auditoria
│   │   ├── notification-service/  # Serviço de notificações
│   │   └── user-service/          # Gerenciamento de usuários
|   |   └── __tests__
├── domain/
│   ├── entities/
|   |   └── __tests__
│   ├── repositories/
├── infrastructure/
│   ├── controllers/
|   |   └── __tests__
│   ├── docker/                 # Dockerfiles e docker-compose
│   ├── database/               # Migrations e seeds
│   ├── redis/                  # Configuração Redis
│   └── repositories/
gateway/                    # API Gateway
└── __tests__  

```

## Fase 1: MVP - Autenticação Básica (Sprint 1-2)

### Objetivo

Implementar autenticação básica funcional com registro, login, JWT e recuperação de senha.

### Componentes Principais

#### 1.1 Infraestrutura Base

- **Docker Compose** com PostgreSQL, Redis, e serviços básicos
- **Estrutura de projeto** TypeScript com monorepo (workspaces)
- **Configuração de ambiente** (.env, variáveis de ambiente)
- **Logging básico** (Winston/Pino)

#### 1.2 API Gateway Básico

- Gateway usando **Express** ou **Fastify**
- Middleware de CORS e parsing JSON
- Roteamento básico para serviços
- Health check endpoints

#### 1.3 Serviço de Usuários (User Service)

- **Modelo de dados**: Tabela `users` (id, email, password_hash, created_at, updated_at)
- **Endpoints**:
  - `POST /api/users/register` - Registro de usuário
  - `GET /api/users/:id` - Obter dados do usuário
- **Funcionalidades**:
  - Hash de senhas com **bcrypt** ou **Argon2**
  - Validação de email único
  - Política básica de senhas (mínimo 8 caracteres, maiúscula, número)

#### 1.4 Serviço de Autenticação (Auth Service)

- **Endpoints**:
  - `POST /api/auth/login` - Login com email/senha
  - `POST /api/auth/logout` - Logout
  - `POST /api/auth/refresh` - Refresh token
- **Funcionalidades**:
  - Validação de credenciais
  - Geração de JWT (access token + refresh token)
  - Rate limiting básico (express-rate-limit)
  - Armazenamento de refresh tokens no Redis

#### 1.5 Recuperação de Senha Básica

- **Endpoints**:
  - `POST /api/auth/forgot-password` - Solicitar reset
  - `POST /api/auth/reset-password` - Resetar senha com token
- **Funcionalidades**:
  - Geração de token temporário (TTL 30min)
  - Armazenamento no Redis
  - Envio de email básico (mock ou SendGrid)

#### 1.6 Middleware de Autenticação

- Validação de JWT em rotas protegidas
- Verificação de token no Redis (blacklist)
- Extração de dados do usuário do token

### Entregas Fase 1

- [ ] Docker Compose funcional
- [ ] API Gateway rodando
- [ ] Registro e login funcionando
- [ ] JWT tokens sendo gerados e validados
- [ ] Recuperação de senha básica
- [ ] Testes unitários básicos

---

## Fase 2: MFA e SSO (Sprint 3-4)

### Objetivo

Adicionar autenticação multifator (TOTP, SMS, Email) e SSO com Google.

### Componentes Principais

#### 2.1 Serviço MFA (MFA Service)

- **Modelo de dados**: Tabela `mfa_secrets` (user_id, secret_encrypted, method, enabled, backup_codes)
- **Endpoints**:
  - `POST /api/mfa/setup` - Configurar MFA
  - `POST /api/mfa/verify` - Verificar código MFA
  - `POST /api/mfa/disable` - Desabilitar MFA
  - `GET /api/mfa/backup-codes` - Gerar códigos de backup
- **Funcionalidades**:
  - Geração de secret TOTP (usando `speakeasy` ou `otplib`)
  - QR Code para apps autenticadores
  - Validação de códigos TOTP (6 dígitos, janela de tempo)
  - Criptografia de secrets (AES-256)
  - Geração de códigos de backup (10 códigos únicos)

#### 2.2 Integração SMS (Twilio/AWS SNS)

- Envio de códigos SMS para MFA
- Rate limiting por usuário
- Armazenamento temporário de códigos (TTL 5min)

#### 2.3 MFA via Email

- Envio de códigos MFA por email
- Integração com SendGrid/AWS SES

#### 2.4 SSO Google OAuth 2.0

- **Endpoints**:
  - `GET /api/auth/google` - Iniciar fluxo OAuth
  - `GET /api/auth/google/callback` - Callback OAuth
- **Funcionalidades**:
  - Integração com Google OAuth 2.0
  - Criação automática de usuário se não existir
  - Vinculação de conta Google a usuário existente
  - Geração de JWT após autenticação SSO

#### 2.5 Fluxo de Login com MFA

- Modificação do Auth Service para verificar MFA após login
- Endpoint intermediário `POST /api/auth/mfa-challenge`
- Retorno de status indicando necessidade de MFA

### Entregas Fase 2

- [ ] Setup e verificação TOTP funcionando
- [ ] Códigos de backup gerados e validados
- [ ] SMS MFA integrado
- [ ] Email MFA funcionando
- [ ] SSO Google OAuth completo
- [ ] Fluxo de login com MFA integrado

---

## Fase 3: Auditoria e Segurança Avançada (Sprint 5-6)

### Objetivo

Implementar sistema completo de auditoria, monitoramento e detecção de anomalias.

### Componentes Principais

#### 3.1 Serviço de Auditoria (Audit Service)

- **Modelo de dados**: Tabela `audit_logs` (id, user_id, event_type, ip_address, user_agent, metadata, timestamp)
- **Eventos auditados**:
  - Login attempts (sucesso/falha)
  - MFA events (setup, verify, disable)
  - Password resets
  - Token issuance
  - Session events (create, destroy)
  - User changes (update, delete)
- **Funcionalidades**:
  - Logging imutável (append-only)
  - Armazenamento em PostgreSQL com índices otimizados
  - Retenção configurável de logs
  - Endpoint de consulta: `GET /api/audit/logs` (com filtros)

#### 3.2 Monitor de Segurança (Security Monitor)

- **Funcionalidades**:
  - Análise de padrões de acesso
  - Detecção de tentativas de força bruta
  - Monitoramento de IPs suspeitos
  - Alertas em tempo real

#### 3.3 Detector de Anomalias

- **Regras básicas**:
  - Múltiplas tentativas de login falhadas
  - Acesso de múltiplos IPs simultâneos
  - Padrões de acesso incomuns
  - Tentativas de reset de senha frequentes
- **Implementação inicial**: Regras baseadas em thresholds
- **Futuro**: ML para detecção avançada

#### 3.4 Sistema de Alertas

- Integração com Notification Service
- Alertas por email para administradores
- Alertas SMS para eventos críticos
- Dashboard de eventos de segurança (futuro)

#### 3.5 Rate Limiting Avançado

- Rate limiting por IP e por usuário
- Proteção contra força bruta
- Sliding window algorithm
- Armazenamento no Redis

### Entregas Fase 3

- [ ] Sistema de auditoria completo
- [ ] Logs sendo registrados para todos os eventos críticos
- [ ] Monitor de segurança básico funcionando
- [ ] Detector de anomalias com regras básicas
- [ ] Sistema de alertas integrado
- [ ] Rate limiting avançado implementado

---

## Fase 4: Otimizações e Integrações (Sprint 7+)

### Objetivo

Otimizar performance, adicionar funcionalidades avançadas e preparar para produção.

### Componentes Principais

#### 4.1 Gerenciamento de Sessões Avançado

- Sessões distribuídas no Redis
- Revogação de sessões
- Limite de sessões simultâneas por usuário
- Endpoint: `GET /api/sessions` e `DELETE /api/sessions/:id`

#### 4.2 Serviço de Notificações Completo

- Templates de email
- Notificações push (WebPush/FCM)
- Preferências de notificação por usuário
- Fila de mensagens (Bull/BullMQ)

#### 4.3 Integração com Produtos

- API para validação de tokens externos
- Webhooks para eventos de autenticação
- SDK para integração fácil

#### 4.4 Performance e Escalabilidade

- Cache de consultas frequentes
- Connection pooling otimizado
- Índices de banco de dados
- Load balancing ready

#### 4.5 Documentação e Testes

- Documentação OpenAPI/Swagger
- Testes de integração completos
- Testes de carga (k6/artillery)
- Guia de deploy

### Entregas Fase 4

- [ ] Sistema de sessões completo
- [ ] Notificações funcionando (email, SMS, push)
- [ ] APIs de integração documentadas
- [ ] Performance otimizada
- [ ] Testes completos
- [ ] Documentação finalizada

---

## Tecnologias e Bibliotecas Principais

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express ou Fastify
- **Database**: PostgreSQL (usuários, auditoria)
- **Cache/Session**: Redis
- **JWT**: `jsonwebtoken` ou `jose`
- **Password Hashing**: `bcrypt` ou `argon2`
- **MFA/TOTP**: `speakeasy` ou `otplib`
- **Email**: `nodemailer` + SendGrid/AWS SES
- **SMS**: Twilio SDK ou AWS SNS
- **OAuth**: `passport` + `passport-google-oauth20`
- **Rate Limiting**: `express-rate-limit` + Redis
- **Validation**: `zod` ou `joi`
- **Testing**: Jest + Supertest
- **Docker**: Docker Compose para desenvolvimento

## Considerações de Segurança

- Senhas nunca armazenadas em texto plano
- Secrets MFA criptografados
- Tokens com TTL apropriado
- HTTPS obrigatório em produção
- Headers de segurança (CORS, CSP, etc.)
- Validação rigorosa de inputs
- Proteção contra SQL injection (ORM/query builder)
- Logs não devem conter informações sensíveis

## Próximos Passos Imediatos

1. Configurar estrutura base do projeto
2. Criar Docker Compose com PostgreSQL e Redis
3. Implementar User Service básico
4. Implementar Auth Service com JWT
5. Criar API Gateway inicial
6. Adicionar recuperação de senha básica