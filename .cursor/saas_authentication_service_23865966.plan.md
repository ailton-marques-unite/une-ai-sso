---
name: SaaS Authentication Service
overview: Desenvolvimento de serviço backend SaaS de autenticação baseado na arquitetura Mermaid, implementado em Node.js/TypeScript com abordagem incremental em fases, começando com Infraestrutura Multi-Tenancy (Fase 0), MVP (Fase 1), MFA/SSO (Fase 2), e expandindo para auditoria, segurança avançada e otimizações.
todos:
  - id: domain-infrastructure
    content: "FASE 0: Configurar infraestrutura multi-tenancy: Database schema domains, domain_roles, user_roles, middleware de domain context, Domain Manager Service"
    status: pending
  - id: domain-crud
    content: "FASE 0: Implementar Domain Management endpoints (POST/GET/PUT/DELETE /domains)"
    status: pending
    dependencies:
      - domain-infrastructure
  - id: setup-infrastructure
    content: "FASE 1: Configurar infraestrutura base: Docker Compose, estrutura de projeto TypeScript, configuração de ambiente e logging"
    status: pending
    dependencies:
      - domain-infrastructure
  - id: api-gateway-basic
    content: "FASE 1: Implementar API Gateway básico com Express/Fastify, middleware de CORS, roteamento, health checks e domain context validation"
    status: pending
    dependencies:
      - setup-infrastructure
  - id: user-service
    content: "FASE 1: Criar User Service com registro de usuários por domínio, hash de senhas (bcrypt/Argon2) e política de senhas básica"
    status: pending
    dependencies:
      - setup-infrastructure
      - domain-infrastructure
  - id: auth-service-basic
    content: "FASE 1: Implementar Auth Service com login/register scoped por domain, geração de JWT com domain_id, e rate limiting por domínio"
    status: pending
    dependencies:
      - user-service
      - api-gateway-basic
  - id: password-recovery
    content: "FASE 1: Implementar recuperação de senha com tokens temporários no Redis e envio de email com escopo de domínio"
    status: pending
    dependencies:
      - auth-service-basic
  - id: auth-middleware
    content: "FASE 1: Criar middleware de autenticação para validação de JWT com validação de domain_id em rotas protegidas"
    status: pending
    dependencies:
      - auth-service-basic
  - id: rbac-service
    content: "FASE 1: Implementar RBAC Service com domain_roles, user_roles e permission checking"
    status: pending
    dependencies:
      - user-service
  - id: mfa-service
    content: "FASE 2: Implementar MFA Service com TOTP, geração de QR codes, códigos de backup com escopo de domínio"
    status: pending
    dependencies:
      - auth-service-basic
  - id: sms-email-mfa
    content: "FASE 2: Integrar MFA via SMS (Twilio/AWS SNS) e Email com rate limiting por domínio"
    status: pending
    dependencies:
      - mfa-service
  - id: google-sso
    content: "FASE 2: Implementar SSO Google OAuth 2.0 com domain discovery via email domain e mapeamento automático"
    status: pending
    dependencies:
      - auth-service-basic
  - id: audit-service
    content: "FASE 3: Criar Audit Service com logging imutável scoped por domain de eventos críticos (login, MFA, password reset, tokens, sessões)"
    status: pending
    dependencies:
      - auth-service-basic
  - id: security-monitoring
    content: "FASE 3: Implementar Security Monitor e Detector de Anomalias com domain-scoped rules para detecção de padrões suspeitos"
    status: pending
    dependencies:
      - audit-service
  - id: alert-system
    content: "FASE 3: Criar sistema de alertas integrado com Notification Service para eventos críticos de segurança com escopo de domain"
    status: pending
    dependencies:
      - security-monitoring
  - id: session-management
    content: "FASE 4: Implementar gerenciamento avançado de sessões distribuídas no Redis com revogação e domain-scoping"
    status: pending
    dependencies:
      - auth-service-basic
  - id: notification-service
    content: "FASE 4: Criar Notification Service completo com templates, preferências de usuário e suporte a email, SMS e push"
    status: pending
    dependencies:
      - alert-system
  - id: integration-apis
    content: "FASE 4: Desenvolver APIs de integração para produtos externos (validação de tokens, webhooks, SDK) com domain context"
    status: pending
    dependencies:
      - auth-service-basic
      - session-management
  - id: optimization-testing
    content: "FASE 4: Otimizar performance (cache, índices, connection pooling) e implementar testes completos (unitários, integração, carga)"
    status: pending
    dependencies:
      - integration-apis
      - notification-service
  - id: documentation
    content: "FASE 4: Criar documentação OpenAPI/Swagger e guia de deploy para produção com exemplos multi-tenant"
    status: pending
    dependencies:
      - optimization-testing
---

# Plano de Desenvolvimento - Serviço de Autenticação SaaS Multi-Tenant

## Arquitetura Geral

O serviço será desenvolvido como uma arquitetura de microsserviços modular com **suporte nativo a multi-tenancy** (Domain/Tenant), seguindo o diagrama Mermaid fornecido. A implementação será em **Node.js/TypeScript** com **Docker** para containerização, permitindo deploy agnóstico de cloud.

## Estrutura do Projeto (COM SUPORTE A MULTI-TENANCY)

```
shared/                     # Código compartilhado
├── types/                  # TypeScript types/interfaces (domain context)
├── utils/                  # Utilitários compartilhados
├── middleware/             # Middlewares reutilizáveis
│   ├── domain-context.middleware.ts    # Extrai e valida domain_id
│   └── domain-isolation.middleware.ts  # Garante isolamento de dados
domains/                    # NOVO: Gerenciamento de domínios
├── application/
│   ├── dtos/
│   ├── services/
│   │   └── domain-service/        # Serviço de CRUD de domínios
├── domain/
│   ├── entities/
│   ├── repositories/
├── infrastructure/
│   ├── controllers/
│   └── repositories/
users/
├── application/
│   ├── dtos/
│   ├── services/
│   │   ├── auth-service/          # Serviço de autenticação (domain-scoped)
│   │   ├── mfa-service/           # Serviço MFA (domain-scoped)
│   │   ├── audit-service/         # Serviço de auditoria (domain-scoped)
│   │   ├── rbac-service/          # Serviço RBAC (domain-scoped) - NOVO
│   │   ├── notification-service/  # Serviço de notificações
│   │   └── user-service/          # Gerenciamento de usuários (domain-scoped)
│   └── __tests__
├── domain/
│   ├── entities/
│   │   ├── user.entity.ts         # Inclui domain_id
│   │   ├── domain-role.entity.ts  # NOVO
│   │   └── user-role.entity.ts    # NOVO
│   └── repositories/
├── infrastructure/
│   ├── controllers/
│   │   └── __tests__
│   ├── docker/                 # Dockerfiles e docker-compose
│   ├── database/               # Migrations com domain schema
│   ├── redis/                  # Configuração Redis (domain-scoped keys)
│   └── repositories/
gateway/                    # API Gateway (com domain context middleware)
└── __tests__  

```

## Fase 0: Infraestrutura Multi-Tenancy (Sprint 0)

### Objetivo

Implementar a base de multi-tenancy com Domains como contexto de isolamento de todos os dados e operações.

### Componentes Principais

#### 0.1 Schema de Banco de Dados

- **Tabela `domains`**: Armazena domínios/organizações
- **Tabela `domain_roles`**: Papéis por domínio (admin, user, editor, etc)
- **Tabela `user_roles`**: Associação user ↔ role
- **Modificações**: Adicionar `domain_id` FK em `users`, `sessions`, `audit_logs`

#### 0.2 Domain Context Middleware

- Extração de `domain_id` ou `domain_slug` do header/path
- Validação que usuário pertence ao domínio
- Injeção de `domain_id` em todas as requisições

#### 0.3 Domain Manager Service

- CRUD de domínios (criar, listar, atualizar, deletar)
- Endpoints: `POST /domains`, `GET /domains/:id`, `PUT /domains/:id`, `DELETE /domains/:id`
- Gerenciamento de membros: `GET /domains/:id/users`, `POST /domains/:id/members`

#### 0.4 Database Isolation

- Índices em `domain_id` para performance
- Repository pattern garante queries filtradas por domínio
- Soft delete com domain context

### Entregas Fase 0

- [x] Schema de banco com domain_id em todas as tabelas críticas
- [x] Domain Context Middleware implementado
- [x] Domain Manager Service com endpoints CRUD
- [x] Índices otimizados
- [ ] Repositories com domain-scoping automático

---

## Fase 1: MVP - Autenticação Básica Multi-Tenant (Sprint 1-2)

### Objetivo

Implementar autenticação básica funcional **com suporte multi-tenant** (domain-scoped) com registro, login, JWT e recuperação de senha.

### Componentes Principais

#### 1.1 Infraestrutura Base

- **Docker Compose** com PostgreSQL, Redis, e serviços básicos
- **Estrutura de projeto** TypeScript com monorepo (workspaces)
- **Configuração de ambiente** (.env, variáveis de ambiente)
- **Logging básico** (Winston/Pino) com domain context
- **Middleware de Domain Context** validando todas as requisições

#### 1.2 API Gateway Básico (Domain-Aware)

- Gateway usando **Express** ou **Fastify**
- Middleware de CORS, parsing JSON e **domain context extraction**
- Roteamento básico com domain-scoping automático
- Health check endpoints
- Rate limiting **por domínio**

#### 1.3 Serviço de Usuários (User Service - Domain-Scoped)

- **Modelo de dados**: Tabela `users` com `domain_id` FK
- **Endpoints**:
  - `POST /auth/register` - Registro com `domain_id` obrigatório
  - `GET /api/users/:id` - Obter dados do usuário (domain-scoped)
- **Funcionalidades**:
  - Hash de senhas com **bcrypt** ou **Argon2**
  - Validação de email único **por domínio**
  - Política básica de senhas

#### 1.4 Serviço de Autenticação (Auth Service - Domain-Scoped)

- **Endpoints**:
  - `POST /api/auth/login` - Login com `domain_id` (domain-scoped)
  - `POST /api/auth/logout` - Logout
  - `POST /api/auth/refresh` - Refresh token (valida domain_id)
- **Funcionalidades**:
  - Validação de credenciais **por domínio**
  - Geração de JWT com `domain_id` no payload
  - Rate limiting **por domínio + email**
  - Armazenamento de refresh tokens no Redis com domain namespace
  - Isolamento absoluto entre domínios

#### 1.5 RBAC Service (Novo)

- **Papéis por domínio**: admin, user, editor, viewer
- **Endpoint**: `GET /api/users/me` retorna roles do usuário no domínio
- **Validação**: Middleware valida permissões baseado no domain_id do token

#### 1.6 Recuperação de Senha Básica (Domain-Scoped)

- **Endpoints**:
  - `POST /api/auth/forgot-password` - Solicitar reset (domain-scoped)
  - `POST /api/auth/reset-password` - Resetar com token (domain-scoped)
- **Funcionalidades**:
  - Geração de token temporário com domain_id (TTL 30min)
  - Armazenamento no Redis com namespace de domínio
  - Envio de email com contexto de domínio

#### 1.7 Middleware de Autenticação (Domain-Aware)

- Validação de JWT com checagem de `domain_id`
- Verificação de domain context em todas as rotas
- Extração de dados do usuário com isolamento por domínio
- Rejeição se domain_id do token ≠ domain_id da requisição

### Entregas Fase 1

- [ ] Docker Compose funcional com domain context support
- [ ] API Gateway rodando com middleware de domain context
- [ ] Registro e login funcionando **por domínio**
- [ ] JWT tokens com domain_id sendo gerados e validados
- [ ] Recuperação de senha **domain-scoped**
- [ ] Rate limiting **por domínio**
- [ ] RBAC Service implementado
- [ ] Testes unitários básicos com isolamento de domínio

---

## Fase 2: MFA e SSO Multi-Tenant (Sprint 3-4)

### Objetivo

Adicionar autenticação multifator (TOTP, SMS, Email) e SSO com Google **com suporte multi-tenant**.

### Componentes Principais

#### 2.1 Serviço MFA (MFA Service - Domain-Scoped)

- **Modelo de dados**: Tabela `user_mfa` com isolamento por domain
- **Endpoints** (domain-scoped):
  - `POST /api/mfa/setup` - Configurar MFA (domain context)
  - `POST /api/mfa/verify` - Verificar código MFA (domain-scoped)
  - `POST /api/mfa/disable` - Desabilitar MFA (domain-scoped)
  - `GET /api/mfa/backup-codes` - Gerar códigos de backup (domain-scoped)
- **Funcionalidades**:
  - Geração de secret TOTP com `domain_id` no QR code label
  - QR Code para apps autenticadores (inclui domain info)
  - Validação de códigos TOTP com isolamento por domínio
  - Criptografia de secrets (AES-256)
  - Geração de códigos de backup (10 códigos únicos)

#### 2.2 Integração SMS (Twilio/AWS SNS - Domain-Scoped)

- Envio de códigos SMS para MFA com domain context
- Rate limiting **por usuário + domínio**
- Armazenamento temporário de códigos no Redis com domain namespace (TTL 5min)

#### 2.3 MFA via Email (Domain-Scoped)

- Envio de códigos MFA por email com contexto de domínio
- Integração com SendGrid/AWS SES (templates por domínio)

#### 2.4 SSO Google OAuth 2.0 (Domain Discovery)

- **Endpoints**:
  - `GET /api/auth/google?domain_id=uuid` - Iniciar fluxo OAuth
  - `GET /api/auth/google/callback?code=auth_code&state=state&domain_id=uuid` - Callback
- **Funcionalidades**:
  - Integração com Google OAuth 2.0 com domain context
  - **Domain discovery via email domain** (ex: nome@company.com → encontra domain com email_domain=company.com)
  - Criação automática de usuário **no domínio descoberto**
  - Vinculação de conta Google a usuário existente **no mesmo domínio**
  - Geração de JWT após autenticação SSO **com domain_id**

#### 2.5 Fluxo de Login com MFA (Domain-Scoped)

- Modificação do Auth Service para verificar MFA após login (domain context)
- Endpoint intermediário `POST /api/auth/mfa-challenge` (domain-scoped)
- Retorno de status indicando necessidade de MFA com domain info

### Entregas Fase 2

- [ ] Setup e verificação TOTP funcionando (domain-scoped)
- [ ] Códigos de backup gerados e validados (domain-scoped)
- [ ] SMS MFA integrado (per-domain rate limiting)
- [ ] Email MFA funcionando (domain context)
- [ ] SSO Google OAuth completo **com domain discovery**
- [ ] Fluxo de login com MFA integrado (domain-scoped)
- [ ] SMS MFA integrado
- [ ] Email MFA funcionando (domain context)
- [ ] SSO Google OAuth completo **com domain discovery**
- [ ] Fluxo de login com MFA integrado (domain-scoped)

---

## Fase 3: Auditoria e Segurança Avançada Multi-Tenant (Sprint 5-6)

### Objetivo

Implementar sistema completo de auditoria, monitoramento e detecção de anomalias **com isolamento por domínio**.

### Componentes Principais

#### 3.1 Serviço de Auditoria (Audit Service - Domain-Scoped)

- **Modelo de dados**: Tabela `audit_logs` com `domain_id` (id, domain_id, user_id, event_type, ip_address, user_agent, metadata, timestamp)
- **Eventos auditados** (domain-scoped):
  - Login attempts (sucesso/falha) por domínio
  - MFA events (setup, verify, disable) por domínio
  - Password resets por domínio
  - Token issuance por domínio
  - Session events (create, destroy) por domínio
  - User changes (update, delete) por domínio
  - **Alterações de RBAC por domínio (NOVO)**
  - **Acessos negados (403) por domínio (NOVO)**
- **Funcionalidades**:
  - Logging imutável (append-only) com domain isolation
  - Armazenamento em PostgreSQL com índices em `domain_id`
  - Retenção configurável de logs por domínio
  - Endpoint de consulta: `GET /api/audit/logs?domain_id=uuid` (com filtros, domain-scoped)
  - **Queries sempre filtradas por domain_id** (isolamento garantido)

#### 3.2 Monitor de Segurança (Security Monitor - Domain-Scoped)

- **Funcionalidades** (com isolamento por domínio):
  - Análise de padrões de acesso **por domínio**
  - Detecção de tentativas de força bruta **por domínio + email**
  - Monitoramento de IPs suspeitos **por domínio**
  - Alertas em tempo real **com contexto de domínio**

#### 3.3 Detector de Anomalias (Domain-Scoped)

- **Regras básicas** (domain-scoped):
  - Múltiplas tentativas de login falhadas (>5 em 15min **por domínio**)
  - Acesso de múltiplos IPs simultâneos (>3 sessões **por usuário no domínio**)
  - Padrões de acesso incomuns **por domínio**
  - Tentativas de reset de senha frequentes **por domínio**
  - **Tentativas de RBAC bypass por domínio (NOVO)**
  - **Abuso de rate limit por domínio (NOVO)**
- **Implementação inicial**: Regras baseadas em thresholds com isolamento de domínio
- **Futuro**: ML para detecção avançada mantendo isolamento

#### 3.4 Sistema de Alertas (Domain-Scoped)

- Integração com Notification Service
- Alertas por email para administradores **do domínio**
- Alertas SMS para eventos críticos **escopo domínio**
- Dashboard de eventos de segurança por domínio (futuro)

#### 3.5 Rate Limiting Avançado (Domain-Scoped)

- Rate limiting por IP e por usuário **por domínio**
- Proteção contra força bruta **com escopo de domínio**
- Sliding window algorithm (Redis com namespace por domínio)
- Armazenamento no Redis com isolamento de chaves

### Entregas Fase 3

- [ ] Sistema de auditoria completo (domain-scoped)
- [ ] Logs sendo registrados para todos os eventos críticos com domain_id
- [ ] Monitor de segurança básico funcionando por domínio
- [ ] Detector de anomalias com regras básicas por domínio
- [ ] Sistema de alertas integrado com contexto de domínio
- [ ] Rate limiting avançado implementado com escopo de domínio

---

## Fase 4: Otimizações e Integrações (Sprint 7+)

### Objetivo

Otimizar performance, adicionar funcionalidades avançadas e preparar para produção **mantendo isolamento de domínios**.

### Componentes Principais

#### 4.1 Gerenciamento de Sessões Avançado (Domain-Scoped)

- Sessões distribuídas no Redis **com namespace por domínio**
- Revogação de sessões por domínio
- Limite de sessões simultâneas por usuário **dentro do domínio**
- Endpoint: `GET /api/domains/:domainId/sessions` e `DELETE /api/domains/:domainId/sessions/:id`
- **Garantia**: Usuário só acessa sessões do próprio domínio

#### 4.2 Serviço de Notificações Completo (Domain-Scoped)

- Templates de email **por domínio** (branding customizado)
- Notificações push (WebPush/FCM) **com contexto de domínio**
- Preferências de notificação por usuário **dentro do domínio**
- Fila de mensagens (Bull/BullMQ) **com isolamento por domínio**
- **Futuro**: Webhooks de eventos por domínio

#### 4.3 Integração com Produtos (Domain-Scoped)

- API para validação de tokens externos **com validação de domínio**
- Webhooks para eventos de autenticação **escopo domínio**
- SDK para integração fácil **com domain_id obrigatório**
- **Novo**: Integração Microsoft OAuth com domain discovery

#### 4.4 Performance e Escalabilidade (Multi-Tenant Aware)

- Cache de consultas frequentes **com chaves namespaced por domínio**
- Connection pooling otimizado **com domain-aware statement caching**
- Índices de banco de dados em domain_id em todas as tabelas críticas
- Load balancing ready **com domain sticky sessions (opcional)**
- **Novo**: Database sharding strategy por domínio (futuro)

#### 4.5 Documentação e Testes

- Documentação OpenAPI/Swagger **com domain context em todos endpoints**
- Testes de integração completos **com fixture setup por domínio**
- Testes de carga (k6/artillery) **com teste de isolamento entre domínios**
- Guia de deploy **com migration path para multi-tenancy**
- **Novo**: Migration script para usuários existentes (default domain)

### Entregas Fase 4

- [ ] Sistema de sessões completo (domain-scoped)
- [ ] Notificações funcionando (email, SMS, push) com contexto de domínio
- [ ] APIs de integração documentadas (domain-aware)
- [ ] Performance otimizada com cache per-domain
- [ ] Testes completos incluindo isolamento entre domínios
- [ ] Documentação finalizada com domain multi-tenancy
- [ ] Migration path para usuários existentes (backward compatibility)

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

## Considerações de Multi-Tenancy

### Isolamento de Dados (Hard Isolation)

- **Estratégia**: Foreign key constraints em domain_id em todas as tabelas
- **Implementação**: 
  - Índices em `domain_id` em tabelas frequentemente consultadas
  - Repositories com escopo automático de domínio (soft delete com domain_id)
  - Middleware validando domain_id em cada requisição
  - **Defense-in-depth**: Queries filtradas por domain_id mesmo com JWT validado

### Backward Compatibility & Migration Path

**Cenário**: Sistema existente (não multi-tenant) evoluindo para multi-tenant

- **Opção 1 - Default Domain**:
  - Usuários existentes associados a um `default_domain` (ex: domain_slug='default')
  - Nova propriedade `domain_id` FK em tabela `users` (migration não-breaking)
  - Usuários legados auto-migrados na primeira requisição (middleware detection)
  - Endpoints aceitam domínio implícito para compatibilidade

- **Opção 2 - Explicit Migration**:
  - CLI script: `npm run migrate:add-tenancy --company-name="Old Company"`
  - Cria domínio, mapeia usuários existentes, atualiza sessions/tokens
  - Requer re-autenticação dos usuários legados

- **Recomendação**: **Opção 1** para continuidade de serviço, com **Opção 2** para admin migration tool

### SSO Multi-Domain Mapping

**Google OAuth**:
- ✅ Domain discovery via email domain (já implementado)
- Fluxo: `user@company.com` → encontra domínio com `email_domain='company.com'` → cria usuário naquele domínio

**Microsoft OAuth (Azure AD) - A Implementar**:
- Tenant ID do Azure AD mapeia para Une.cx domain
- Config: `tenantId` no domínio (table `domains` adiciona coluna `ms_tenant_id`)
- Fluxo: Login via Microsoft → extrair Microsoft tenant ID → encontrar domain correspondente
- Provisioning: Script para sincronizar usuários Azure AD com domínio Une.cx

**GitHub OAuth (Futuro)**:
- GitHub Organization → Une.cx Domain
- Requer `org` claim em OAuth callback
- Auto-provisioning de equipes

### Rate Limiting Por Domínio

- Chaves Redis: `rl:operation:domainId:identifier` (ex: `rl:login:abc-uuid:user@company.com`)
- Limites diferentes por tipo de operação e domínio (admin pode customizar via API)
- Proteção contra cross-domain abuse (domínio isolado não afeta outro)

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