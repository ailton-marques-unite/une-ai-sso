# Script de Testes da API SSO

Este documento descreve como usar o script `test-api.sh` para testar todas as rotas e endpoints da API SSO.

## Pré-requisitos

- `bash` (versão 4.0 ou superior)
- `curl` instalado
- `jq` instalado (para formatação JSON)

### Instalação das Dependências

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install curl jq
```

**macOS:**
```bash
brew install curl jq
```

**CentOS/RHEL:**
```bash
sudo yum install curl jq
```

## Configuração

O script pode ser configurado através de variáveis de ambiente ou editando as variáveis no início do arquivo `test-api.sh`:

```bash
# URL base da API
BASE_URL="http://localhost:3000"

# Domain Context
DOMAIN_SLUG="unite-group"
DOMAIN_ID=""  # Opcional, será usado se fornecido

# Credenciais de teste
TEST_EMAIL="teste@example.com"
TEST_PASSWORD="SenhaSegura123!@#"
TEST_FULL_NAME="Usuário de Teste"
TEST_PHONE="+5511999999999"
```

### Configuração via Variáveis de Ambiente

Você também pode configurar via variáveis de ambiente antes de executar:

```bash
export BASE_URL="http://localhost:3000"
export DOMAIN_SLUG="meu-dominio"
export TEST_EMAIL="meu-email@example.com"
export TEST_PASSWORD="MinhaSenha123!@#"
./test-api.sh
```

## Uso

### Modo Interativo

Execute o script sem argumentos para entrar no modo interativo:

```bash
./test-api.sh
```

O menu permitirá escolher qual categoria de testes executar:
- Health Check
- Domain Management
- Authentication
- Password Recovery
- Users
- MFA
- SSO
- Todos os testes

### Modo Direto (Linha de Comando)

Execute testes específicos passando o nome da categoria como argumento:

```bash
# Testar apenas Health Check
./test-api.sh health

# Testar apenas Domain Management
./test-api.sh domains

# Testar apenas Authentication
./test-api.sh auth

# Testar apenas Password Recovery
./test-api.sh password

# Testar apenas Users
./test-api.sh users

# Testar apenas MFA
./test-api.sh mfa

# Testar apenas SSO
./test-api.sh sso

# Executar TODOS os testes
./test-api.sh all
```

## Estrutura dos Testes

### 1. Health Check

Testa os endpoints de verificação de saúde da API:
- `GET /health` - Health check básico
- `GET /health/detailed` - Health check detalhado (inclui status de database e Redis)

### 2. Domain Management

Testa os endpoints de gerenciamento de domínios:
- `POST /domains` - Criar novo domínio
- `GET /domains` - Listar domínios
- `GET /domains/:id` - Obter domínio por ID
- `GET /domains/slug/:slug` - Obter domínio por slug
- `PUT /domains/:id` - Atualizar domínio
- `DELETE /domains/:id` - Desativar domínio
- `PATCH /domains/:id/activate` - Reativar domínio

**Nota:** O script cria automaticamente um domínio de teste e usa seu ID/slug nos testes subsequentes.

### 3. Authentication

Testa os endpoints de autenticação:
- `POST /auth/register` - Registrar novo usuário
- `POST /auth/login` - Login com credenciais
- `POST /auth/refresh` - Renovar access token
- `POST /auth/logout` - Logout
- `POST /auth/mfa-challenge` - Verificar código MFA após login

**Nota:** O script salva automaticamente os tokens (`ACCESS_TOKEN`, `REFRESH_TOKEN`) para uso em testes subsequentes.

### 4. Password Recovery

Testa os endpoints de recuperação de senha:
- `POST /auth/password/forgot` - Solicitar reset de senha
- `POST /auth/password/reset` - Redefinir senha com token

**Nota:** O endpoint de reset requer um token válido recebido por email.

### 5. Users

Testa os endpoints de gerenciamento de usuários:
- `GET /users/me` - Obter informações do usuário autenticado
- `GET /users/:id` - Obter usuário por ID

**Nota:** Requer autenticação (ACCESS_TOKEN).

### 6. MFA (Multi-Factor Authentication)

Testa os endpoints de autenticação multifator:
- `POST /mfa/setup` - Configurar MFA (TOTP)
- `POST /mfa/verify` - Verificar código MFA para habilitar
- `GET /mfa/backup-codes` - Gerar novos códigos de backup
- `POST /mfa/send-code` - Enviar código MFA via SMS ou Email
- `POST /mfa/disable` - Desabilitar MFA

**Nota:** Requer autenticação (ACCESS_TOKEN). Alguns testes requerem códigos MFA válidos.

### 7. SSO (Single Sign-On)

Testa os endpoints de SSO:
- `GET /auth/sso/google` - Iniciar autenticação Google OAuth
- `GET /auth/sso/google/callback` - Callback Google OAuth
- `GET /auth/sso/microsoft` - Iniciar autenticação Microsoft OAuth
- `GET /auth/sso/microsoft/callback` - Callback Microsoft OAuth

**Nota:** Os callbacks requerem códigos de autorização válidos do provedor OAuth.

## Exemplos de Payloads e Respostas

O script exibe automaticamente:
- **Request:** O endpoint sendo testado
- **Payload:** O JSON enviado (quando aplicável)
- **Response:** A resposta recebida da API (formatada com jq)
- **Resposta Esperada:** Um exemplo comentado da resposta esperada

### Exemplo de Saída

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TESTES DE AUTENTICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ POST /auth/login - Login
Request: POST http://localhost:3000/auth/login
ℹ Payload:
{
  "email": "teste@example.com",
  "password": "SenhaSegura123!@#"
}
Response:
{
  "mfa_required": false,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
Resposta Esperada:
{
  "mfa_required": false,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  ...
}
✓ Login realizado com sucesso
```

## Fluxo Recomendado de Testes

Para testar o fluxo completo, execute na seguinte ordem:

1. **Health Check** - Verificar se a API está funcionando
2. **Domain Management** - Criar um domínio de teste
3. **Authentication** - Registrar e fazer login
4. **Users** - Verificar informações do usuário
5. **MFA** - Configurar e testar MFA
6. **Password Recovery** - Testar recuperação de senha
7. **SSO** - Testar integração com Google/Microsoft (requer configuração OAuth)

## Troubleshooting

### Erro: "jq não está instalado"

Instale o jq conforme as instruções na seção Pré-requisitos.

### Erro: "curl não está instalado"

Instale o curl conforme as instruções na seção Pré-requisitos.

### Erro: "Domain context is required"

Certifique-se de que `DOMAIN_SLUG` ou `DOMAIN_ID` está configurado. Execute primeiro os testes de Domain Management para criar um domínio.

### Erro: "Unauthorized (401)"

Certifique-se de que:
- O usuário foi registrado e fez login
- O `ACCESS_TOKEN` está válido (não expirado)
- O Domain Context está correto

### Erro: "Too Many Requests (429)"

Você atingiu o limite de rate limiting. Aguarde alguns minutos ou limpe as chaves do Redis:

```bash
redis-cli --scan --pattern "throttler:*" | xargs redis-cli DEL
```

### Testes de MFA não funcionam

Alguns testes de MFA requerem códigos válidos:
- Para TOTP: Use um código do app autenticador (Google Authenticator, Authy, etc.)
- Para SMS/Email: O código será enviado automaticamente, mas você precisa inseri-lo manualmente

### Testes de SSO não funcionam

Os testes de SSO requerem:
- Configuração correta das variáveis de ambiente OAuth (GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID, etc.)
- Códigos de autorização válidos do provedor OAuth
- URLs de callback configuradas corretamente

## Variáveis Armazenadas Durante os Testes

O script armazena automaticamente:
- `ACCESS_TOKEN` - Token de acesso JWT
- `REFRESH_TOKEN` - Token de refresh
- `MFA_TOKEN` - Token temporário para desafio MFA
- `CREATED_DOMAIN_ID` - ID do domínio criado
- `CREATED_USER_ID` - ID do usuário criado
- `MFA_SECRET` - Secret TOTP gerado
- `MFA_BACKUP_CODES` - Códigos de backup MFA

Essas variáveis são usadas automaticamente nos testes subsequentes.

## Personalização

Você pode personalizar o script editando:
- Variáveis de configuração no início do arquivo
- Funções de teste individuais
- Formatação de saída (cores, mensagens)

## Documentação Adicional

Para mais informações sobre os endpoints, consulte:
- `API_EXAMPLES.md` - Exemplos de uso da API
- `API_EXAMPLES_AUTH.md` - Exemplos específicos de autenticação
- Swagger UI: `http://localhost:3000/api` (quando a API estiver rodando)

## Suporte

Em caso de problemas ou dúvidas, consulte a documentação do projeto ou entre em contato com a equipe de desenvolvimento.
