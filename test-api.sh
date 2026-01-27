#!/bin/bash

################################################################################
# Script de Testes da API SSO - UNE.AI
# 
# Este script testa todas as rotas e endpoints desenvolvidos no projeto SSO.
# Inclui exemplos de payloads e respostas esperadas.
#
# Uso:
#   chmod +x test-api.sh
#   ./test-api.sh
#
# Variáveis de ambiente podem ser configuradas no início do script.
################################################################################

set -e  # Parar em caso de erro

# ==============================================================================
# CONFIGURAÇÃO
# ==============================================================================

# URL base da API
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Domain Context (pode ser alterado conforme necessário)
DOMAIN_SLUG="${DOMAIN_SLUG:-unite-group}"
DOMAIN_ID="${DOMAIN_ID:-39691799-8575-48dc-b63c-70774c51a99a}"

# Credenciais de teste
TEST_EMAIL="${TEST_EMAIL:-teste@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-SenhaSegura123!@#}"
TEST_FULL_NAME="${TEST_FULL_NAME:-Usuário de Teste}"
TEST_PHONE="${TEST_PHONE:-+5511999999999}"

# Variáveis para armazenar tokens e IDs durante os testes
ACCESS_TOKEN=""
REFRESH_TOKEN=""
MFA_TOKEN=""
CREATED_DOMAIN_ID=""
CREATED_USER_ID=""
MFA_SECRET=""
MFA_BACKUP_CODES=""

# ==============================================================================
# CORES PARA OUTPUT
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==============================================================================
# FUNÇÕES AUXILIARES
# ==============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_request() {
    echo -e "${MAGENTA}Request:${NC} $1"
}

print_response() {
    echo -e "${GREEN}Response:${NC}"
    echo "$1" | jq '.' 2>/dev/null || echo "$1"
}

print_expected() {
    echo -e "${YELLOW}Resposta Esperada:${NC}"
    echo -e "${YELLOW}$1${NC}"
}

# Função para fazer requisições HTTP
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4
    local url="${BASE_URL}${endpoint}"
    
    local curl_cmd="curl -s -w '\n%{http_code}' -X ${method}"
    
    # Adicionar headers padrão
    curl_cmd="${curl_cmd} -H 'Content-Type: application/json'"
    curl_cmd="${curl_cmd} -H 'Accept: application/json'"
    
    # Adicionar Domain Context se não estiver nos headers customizados
    if [[ ! "$headers" =~ "x-domain" ]]; then
        if [ -n "$DOMAIN_ID" ]; then
            curl_cmd="${curl_cmd} -H 'x-domain-id: ${DOMAIN_ID}'"
        elif [ -n "$DOMAIN_SLUG" ]; then
            curl_cmd="${curl_cmd} -H 'x-domain-slug: ${DOMAIN_SLUG}'"
        fi
    fi
    
    # Adicionar headers customizados
    if [ -n "$headers" ]; then
        curl_cmd="${curl_cmd} ${headers}"
    fi
    
    # Adicionar Authorization header se ACCESS_TOKEN estiver definido
    if [ -n "$ACCESS_TOKEN" ] && [[ ! "$headers" =~ "Authorization" ]]; then
        curl_cmd="${curl_cmd} -H 'Authorization: Bearer ${ACCESS_TOKEN}'"
    fi
    
    # Adicionar dados se for POST/PUT/PATCH
    if [ -n "$data" ] && [[ "$method" =~ ^(POST|PUT|PATCH)$ ]]; then
        curl_cmd="${curl_cmd} -d '${data}'"
    fi
    
    curl_cmd="${curl_cmd} '${url}'"
    
    eval "$curl_cmd"
}

# Função para extrair valor JSON
extract_json_value() {
    local json=$1
    local key=$2
    echo "$json" | jq -r ".${key}" 2>/dev/null || echo ""
}

# ==============================================================================
# TESTES - HEALTH CHECK
# ==============================================================================

test_health_check() {
    print_header "TESTES DE HEALTH CHECK"
    
    print_section "GET /health - Health Check Básico"
    print_request "GET ${BASE_URL}/health"
    
    response=$(make_request "GET" "/health" "" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "status": "ok",
  "timestamp": "2026-01-26T...",
  "uptime": 123.456
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "Health check básico OK"
    else
        print_error "Health check básico falhou (HTTP $http_code)"
    fi
    
    print_section "GET /health/detailed - Health Check Detalhado"
    print_request "GET ${BASE_URL}/health/detailed"
    
    response=$(make_request "GET" "/health/detailed" "" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "status": "ok",
  "timestamp": "2026-01-26T...",
  "uptime": 123.456,
  "services": {
    "database": "up",
    "redis": "up"
  }
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "Health check detalhado OK"
    else
        print_error "Health check detalhado falhou (HTTP $http_code)"
    fi
}

# ==============================================================================
# TESTES - DOMAIN MANAGEMENT
# ==============================================================================

test_domain_management() {
    print_header "TESTES DE GERENCIAMENTO DE DOMÍNIOS"
    
    print_section "POST /domains - Criar Novo Domínio"
    print_request "POST ${BASE_URL}/domains"
    
    domain_data=$(cat <<EOF
{
  "name": "Domínio de Teste",
  "slug": "dominio-teste-$(date +%s)",
  "description": "Domínio criado para testes automatizados"
}
EOF
)
    
    print_info "Payload:"
    echo "$domain_data" | jq '.'
    
    response=$(make_request "POST" "/domains" "$domain_data" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "id": "uuid-do-dominio",
  "name": "Domínio de Teste",
  "slug": "dominio-teste-...",
  "description": "Domínio criado para testes automatizados",
  "is_active": true,
  "created_at": "2026-01-26T...",
  "updated_at": "2026-01-26T..."
}'
    
    if [ "$http_code" = "201" ]; then
        CREATED_DOMAIN_ID=$(extract_json_value "$body" "id")
        DOMAIN_SLUG=$(extract_json_value "$body" "slug")
        print_success "Domínio criado com sucesso (ID: $CREATED_DOMAIN_ID)"
        print_info "Usando slug: $DOMAIN_SLUG para próximos testes"
    else
        print_error "Falha ao criar domínio (HTTP $http_code)"
    fi
    
    print_section "GET /domains - Listar Domínios"
    print_request "GET ${BASE_URL}/domains?page=1&limit=10"
    
    response=$(make_request "GET" "/domains?page=1&limit=10" "" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "data": [
    {
      "id": "uuid",
      "name": "...",
      "slug": "...",
      "is_active": true
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "Listagem de domínios OK"
    else
        print_error "Falha ao listar domínios (HTTP $http_code)"
    fi
    
    if [ -n "$CREATED_DOMAIN_ID" ]; then
        print_section "GET /domains/:id - Obter Domínio por ID"
        print_request "GET ${BASE_URL}/domains/${CREATED_DOMAIN_ID}"
        
        response=$(make_request "GET" "/domains/${CREATED_DOMAIN_ID}" "" "")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        print_response "$body"
        
        if [ "$http_code" = "200" ]; then
            print_success "Domínio obtido por ID OK"
        else
            print_error "Falha ao obter domínio por ID (HTTP $http_code)"
        fi
        
        print_section "GET /domains/slug/:slug - Obter Domínio por Slug"
        print_request "GET ${BASE_URL}/domains/slug/${DOMAIN_SLUG}"
        
        response=$(make_request "GET" "/domains/slug/${DOMAIN_SLUG}" "" "")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        print_response "$body"
        
        if [ "$http_code" = "200" ]; then
            print_success "Domínio obtido por slug OK"
        else
            print_error "Falha ao obter domínio por slug (HTTP $http_code)"
        fi
        
        print_section "PUT /domains/:id - Atualizar Domínio"
        print_request "PUT ${BASE_URL}/domains/${CREATED_DOMAIN_ID}"
        
        update_data=$(cat <<EOF
{
  "name": "Domínio de Teste Atualizado",
  "description": "Descrição atualizada"
}
EOF
)
        
        print_info "Payload:"
        echo "$update_data" | jq '.'
        
        response=$(make_request "PUT" "/domains/${CREATED_DOMAIN_ID}" "$update_data" "")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        print_response "$body"
        
        if [ "$http_code" = "200" ]; then
            print_success "Domínio atualizado OK"
        else
            print_error "Falha ao atualizar domínio (HTTP $http_code)"
        fi
        
        print_section "DELETE /domains/:id - Desativar Domínio"
        print_request "DELETE ${BASE_URL}/domains/${CREATED_DOMAIN_ID}"
        
        response=$(make_request "DELETE" "/domains/${CREATED_DOMAIN_ID}" "" "")
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "204" ]; then
            print_success "Domínio desativado OK"
        else
            print_error "Falha ao desativar domínio (HTTP $http_code)"
        fi
        
        print_section "PATCH /domains/:id/activate - Reativar Domínio"
        print_request "PATCH ${BASE_URL}/domains/${CREATED_DOMAIN_ID}/activate"
        
        response=$(make_request "PATCH" "/domains/${CREATED_DOMAIN_ID}/activate" "" "")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        print_response "$body"
        
        if [ "$http_code" = "200" ]; then
            print_success "Domínio reativado OK"
        else
            print_error "Falha ao reativar domínio (HTTP $http_code)"
        fi
    else
        print_error "Não é possível testar endpoints que requerem DOMAIN_ID"
    fi
}

# ==============================================================================
# TESTES - AUTHENTICATION
# ==============================================================================

test_authentication() {
    print_header "TESTES DE AUTENTICAÇÃO"
    
    if [ -z "$DOMAIN_SLUG" ] && [ -z "$DOMAIN_ID" ]; then
        print_error "DOMAIN_SLUG ou DOMAIN_ID deve ser configurado para testes de autenticação"
        return
    fi
    
    print_section "POST /auth/register - Registrar Novo Usuário"
    print_request "POST ${BASE_URL}/auth/register"
    
    register_data=$(cat <<EOF
{
  "email": "${TEST_EMAIL}",
  "password": "${TEST_PASSWORD}",
  "full_name": "${TEST_FULL_NAME}",
  "phone": "${TEST_PHONE}"
}
EOF
)
    
    print_info "Payload:"
    echo "$register_data" | jq '.'
    
    response=$(make_request "POST" "/auth/register" "$register_data" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "id": "uuid-do-usuario",
  "domain_id": "uuid-do-dominio",
  "email": "teste@example.com",
  "full_name": "Usuário de Teste",
  "phone": "+5511999999999",
  "is_active": true,
  "is_verified": false,
  "mfa_enabled": false,
  "created_at": "2026-01-26T..."
}'
    
    if [ "$http_code" = "201" ]; then
        CREATED_USER_ID=$(extract_json_value "$body" "id")
        print_success "Usuário registrado com sucesso (ID: $CREATED_USER_ID)"
    else
        print_error "Falha ao registrar usuário (HTTP $http_code)"
        print_info "Usuário pode já existir, continuando com testes de login..."
    fi
    
    print_section "POST /auth/login - Login"
    print_request "POST ${BASE_URL}/auth/login"
    
    login_data=$(cat <<EOF
{
  "email": "${TEST_EMAIL}",
  "password": "${TEST_PASSWORD}"
}
EOF
)
    
    print_info "Payload:"
    echo "$login_data" | jq '.'
    
    response=$(make_request "POST" "/auth/login" "$login_data" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    
    if [ "$http_code" = "200" ]; then
        ACCESS_TOKEN=$(extract_json_value "$body" "access_token")
        REFRESH_TOKEN=$(extract_json_value "$body" "refresh_token")
        MFA_REQUIRED=$(extract_json_value "$body" "mfa_required")
        
        if [ "$MFA_REQUIRED" = "true" ]; then
            MFA_TOKEN=$(extract_json_value "$body" "mfa_token")
            print_info "MFA é necessário. mfa_token: $MFA_TOKEN"
            print_expected '{
  "mfa_required": true,
  "mfa_token": "temp_token_abc123",
  "available_methods": ["totp", "sms", "email"],
  "message": "MFA é necessário para completar o login"
}'
        else
            print_success "Login realizado com sucesso"
            print_info "Access Token salvo para próximos testes"
            print_expected '{
  "mfa_required": false,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer"
}'
        fi
    else
        print_error "Falha no login (HTTP $http_code)"
    fi
    
    if [ -n "$REFRESH_TOKEN" ]; then
        print_section "POST /auth/refresh - Renovar Access Token"
        print_request "POST ${BASE_URL}/auth/refresh"
        
        refresh_data=$(cat <<EOF
{
  "refresh_token": "${REFRESH_TOKEN}"
}
EOF
)
        
        print_info "Payload:"
        echo "$refresh_data" | jq '.'
        
        response=$(make_request "POST" "/auth/refresh" "$refresh_data" "")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        print_response "$body"
        print_expected '{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer"
}'
        
        if [ "$http_code" = "200" ]; then
            ACCESS_TOKEN=$(extract_json_value "$body" "access_token")
            print_success "Token renovado com sucesso"
        else
            print_error "Falha ao renovar token (HTTP $http_code)"
        fi
    fi
    
#    if [ -n "$ACCESS_TOKEN" ]; then
#        print_section "POST /auth/logout - Logout"
#        print_request "POST ${BASE_URL}/auth/logout"
#        
#        logout_data=$(cat <<EOF
#{
#  "refresh_token": "${REFRESH_TOKEN}"
#}
#EOF
#)
#        
#        print_info "Payload:"
#        echo "$logout_data" | jq '.'
#        
#        response=$(make_request "POST" "/auth/logout" "$logout_data" "")
#        http_code=$(echo "$response" | tail -n1)
#        body=$(echo "$response" | sed '$d')
#        
#        print_response "$body"
#        print_expected '{
#            "success": true,
#            "message": "Logout realizado com sucesso"
#            }'
#        
#        if [ "$http_code" = "200" ]; then
#            print_success "Logout realizado com sucesso"
#            # Limpar tokens após logout
#            ACCESS_TOKEN=""
#            REFRESH_TOKEN=""
#        else
#            print_error "Falha no logout (HTTP $http_code)"
#        fi
#    fi
    
    if [ -n "$MFA_TOKEN" ]; then
        print_section "POST /auth/mfa-challenge - Verificar Código MFA"
        print_request "POST ${BASE_URL}/auth/mfa-challenge"
        print_info "Nota: Este teste requer um código MFA válido. Use um código do app autenticador ou código de backup."
        
        mfa_challenge_data=$(cat <<EOF
{
  "mfa_token": "${MFA_TOKEN}",
  "code": "123456",
  "method": "totp"
}
EOF
)
        
        print_info "Payload (exemplo):"
        echo "$mfa_challenge_data" | jq '.'
        print_expected '{
  "mfa_required": false,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer"
}'
    fi
}

# ==============================================================================
# TESTES - PASSWORD RECOVERY
# ==============================================================================

test_password_recovery() {
    print_header "TESTES DE RECUPERAÇÃO DE SENHA"
    
    if [ -z "$DOMAIN_SLUG" ] && [ -z "$DOMAIN_ID" ]; then
        print_error "DOMAIN_SLUG ou DOMAIN_ID deve ser configurado"
        return
    fi
    
    print_section "POST /auth/password/forgot - Solicitar Reset de Senha"
    print_request "POST ${BASE_URL}/auth/password/forgot"
    
    forgot_data=$(cat <<EOF
{
  "email": "${TEST_EMAIL}"
}
EOF
)
    
    print_info "Payload:"
    echo "$forgot_data" | jq '.'
    
    response=$(make_request "POST" "/auth/password/forgot" "$forgot_data" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "success": true,
  "message": "Se o e-mail existir, um link de recuperação será enviado."
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "Solicitação de reset de senha enviada"
        print_info "Nota: Verifique o email para obter o token de reset"
    else
        print_error "Falha ao solicitar reset de senha (HTTP $http_code)"
    fi
    
    print_section "POST /auth/password/reset - Redefinir Senha"
    print_request "POST ${BASE_URL}/auth/password/reset"
    print_info "Nota: Este teste requer um token válido recebido por email"
    
    reset_data=$(cat <<EOF
{
  "token": "token_recebido_por_email",
  "new_password": "NovaSenhaSegura123!@#"
}
EOF
)
    
    print_info "Payload (exemplo):"
    echo "$reset_data" | jq '.'
    print_expected '{
  "success": true,
  "message": "Senha redefinida com sucesso"
}'
}

# ==============================================================================
# TESTES - USERS
# ==============================================================================

test_users() {
    print_header "TESTES DE USUÁRIOS"
    
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "ACCESS_TOKEN necessário. Execute login primeiro."
        return
    fi
    
    print_section "GET /users/me - Obter Informações do Usuário Autenticado"
    print_request "GET ${BASE_URL}/users/me"
    
    response=$(make_request "GET" "/users/me" "" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "id": "uuid-do-usuario",
  "domain_id": "uuid-do-dominio",
  "email": "teste@example.com",
  "full_name": "Usuário de Teste",
  "phone": "+5511999999999",
  "is_active": true,
  "is_verified": true,
  "mfa_enabled": false,
  "last_login_at": "2026-01-26T...",
  "roles": ["admin", "user"],
  "permissions": ["users:read", "users:write"]
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "Informações do usuário obtidas com sucesso"
        if [ -z "$CREATED_USER_ID" ]; then
            CREATED_USER_ID=$(extract_json_value "$body" "id")
        fi
    else
        print_error "Falha ao obter informações do usuário (HTTP $http_code)"
    fi
    
    if [ -n "$CREATED_USER_ID" ]; then
        print_section "GET /users/:id - Obter Usuário por ID"
        print_request "GET ${BASE_URL}/users/${CREATED_USER_ID}"
        
        response=$(make_request "GET" "/users/${CREATED_USER_ID}" "" "")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        print_response "$body"
        print_expected '{
  "id": "uuid-do-usuario",
  "domain_id": "uuid-do-dominio",
  "email": "teste@example.com",
  "full_name": "Usuário de Teste",
  "is_active": true
}'
        
        if [ "$http_code" = "200" ]; then
            print_success "Usuário obtido por ID com sucesso"
        else
            print_error "Falha ao obter usuário por ID (HTTP $http_code)"
        fi
    fi
}

# ==============================================================================
# TESTES - MFA
# ==============================================================================

test_mfa() {
    print_header "TESTES DE MFA (MULTI-FACTOR AUTHENTICATION)"
    
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "ACCESS_TOKEN necessário. Execute login primeiro."
        return
    fi
    
    print_section "POST /mfa/setup - Configurar MFA"
    print_request "POST ${BASE_URL}/mfa/setup"
    
    mfa_setup_data=$(cat <<EOF
{
  "method": "totp"
}
EOF
)
    
    print_info "Payload:"
    echo "$mfa_setup_data" | jq '.'
    
    response=$(make_request "POST" "/mfa/setup" "$mfa_setup_data" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "backup_codes": ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", ...]
}'
    
    if [ "$http_code" = "200" ]; then
        MFA_SECRET=$(extract_json_value "$body" "secret")
        MFA_BACKUP_CODES=$(extract_json_value "$body" "backup_codes")
        print_success "MFA configurado com sucesso"
        print_info "Secret: $MFA_SECRET"
        print_info "Nota: Escaneie o QR code com um app autenticador (Google Authenticator, Authy, etc.)"
    else
        print_error "Falha ao configurar MFA (HTTP $http_code)"
    fi
    
    print_section "POST /mfa/verify - Verificar e Habilitar MFA"
    print_request "POST ${BASE_URL}/mfa/verify"
    print_info "Nota: Este teste requer um código MFA válido do app autenticador"
    
    mfa_verify_data=$(cat <<EOF
{
  "code": "123456",
  "method": "totp"
}
EOF
)
    
    print_info "Payload (exemplo):"
    echo "$mfa_verify_data" | jq '.'
    print_expected '{
  "success": true,
  "message": "MFA habilitado com sucesso"
}'
    
    print_section "GET /mfa/backup-codes - Gerar Novos Códigos de Backup"
    print_request "GET ${BASE_URL}/mfa/backup-codes"
    
    response=$(make_request "GET" "/mfa/backup-codes" "" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "backup_codes": ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", ...]
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "Códigos de backup gerados com sucesso"
    else
        print_error "Falha ao gerar códigos de backup (HTTP $http_code)"
    fi
    
    print_section "POST /mfa/send-code - Enviar Código MFA via SMS ou Email"
    print_request "POST ${BASE_URL}/mfa/send-code"
    
    send_code_data=$(cat <<EOF
{
  "method": "sms"
}
EOF
)
    
    print_info "Payload:"
    echo "$send_code_data" | jq '.'
    
    response=$(make_request "POST" "/mfa/send-code" "$send_code_data" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "success": true,
  "message": "Código enviado via sms",
  "expiresIn": 300
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "Código MFA enviado com sucesso"
    else
        print_error "Falha ao enviar código MFA (HTTP $http_code)"
    fi
    
    print_section "POST /mfa/disable - Desabilitar MFA"
    print_request "POST ${BASE_URL}/mfa/disable"
    
    response=$(make_request "POST" "/mfa/disable" "" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "success": true,
  "message": "MFA desabilitado com sucesso"
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "MFA desabilitado com sucesso"
    else
        print_error "Falha ao desabilitar MFA (HTTP $http_code)"
    fi
}

# ==============================================================================
# TESTES - SSO
# ==============================================================================

test_sso() {
    print_header "TESTES DE SSO (SINGLE SIGN-ON)"
    
    if [ -z "$DOMAIN_ID" ] && [ -z "$CREATED_DOMAIN_ID" ]; then
        print_error "DOMAIN_ID necessário para testes de SSO"
        return
    fi
    
    local domain_id_for_sso="${DOMAIN_ID:-$CREATED_DOMAIN_ID}"
    
    print_section "GET /auth/sso/google - Iniciar Autenticação Google"
    print_request "GET ${BASE_URL}/auth/sso/google?domain_id=${domain_id_for_sso}"
    
    response=$(make_request "GET" "/auth/sso/google?domain_id=${domain_id_for_sso}" "" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "random_state_token"
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "URL de autenticação Google gerada"
        print_info "Nota: Abra a authUrl no navegador para completar o fluxo OAuth"
    else
        print_error "Falha ao iniciar autenticação Google (HTTP $http_code)"
    fi
    
    print_section "GET /auth/sso/google/callback - Callback Google OAuth"
    print_request "GET ${BASE_URL}/auth/sso/google/callback?code=CODE&state=STATE"
    print_info "Nota: Este endpoint é chamado pelo Google após autorização. Requer code e state válidos."
    print_expected '{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "message": "Autenticação Google realizada com sucesso"
}'
    
    print_section "GET /auth/sso/microsoft - Iniciar Autenticação Microsoft"
    print_request "GET ${BASE_URL}/auth/sso/microsoft?domain_id=${domain_id_for_sso}"
    
    response=$(make_request "GET" "/auth/sso/microsoft?domain_id=${domain_id_for_sso}" "" "")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_response "$body"
    print_expected '{
  "authUrl": "https://login.microsoftonline.com/.../oauth2/v2.0/authorize?...",
  "state": "random_state_token"
}'
    
    if [ "$http_code" = "200" ]; then
        print_success "URL de autenticação Microsoft gerada"
        print_info "Nota: Abra a authUrl no navegador para completar o fluxo OAuth"
    else
        print_error "Falha ao iniciar autenticação Microsoft (HTTP $http_code)"
    fi
    
    print_section "GET /auth/sso/microsoft/callback - Callback Microsoft OAuth"
    print_request "GET ${BASE_URL}/auth/sso/microsoft/callback?code=CODE&state=STATE"
    print_info "Nota: Este endpoint é chamado pelo Microsoft após autorização. Requer code e state válidos."
    print_expected '{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "message": "Autenticação Microsoft realizada com sucesso"
}'
}

# ==============================================================================
# Finish Test
# ==============================================================================

finish_test() {
    if [ -n "$ACCESS_TOKEN" ]; then
        print_section "POST /auth/logout - Logout"
        print_request "POST ${BASE_URL}/auth/logout"
        
        logout_data=$(cat <<EOF
{
  "refresh_token": "${REFRESH_TOKEN}"
}
EOF
)
        
        print_info "Payload:"
        echo "$logout_data" | jq '.'
        
        response=$(make_request "POST" "/auth/logout" "$logout_data" "")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        print_response "$body"
        print_expected '{
            "success": true,
            "message": "Logout realizado com sucesso"
            }'
        
        if [ "$http_code" = "200" ]; then
            print_success "Logout realizado com sucesso"
            # Limpar tokens após logout
            ACCESS_TOKEN=""
            REFRESH_TOKEN=""
        else
            print_error "Falha no logout (HTTP $http_code)"
        fi
    fi
    echo "Finalizando testes... "
}

# ==============================================================================
# MENU PRINCIPAL
# ==============================================================================

show_menu() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          SCRIPT DE TESTES DA API SSO - UNE.AI                 ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Configuração Atual:${NC}"
    echo "  BASE_URL: $BASE_URL"
    echo "  DOMAIN_SLUG: ${DOMAIN_SLUG:-não configurado}"
    echo "  DOMAIN_ID: ${DOMAIN_ID:-não configurado}"
    echo "  TEST_EMAIL: $TEST_EMAIL"
    echo ""
    echo -e "${YELLOW}Escolha uma opção:${NC}"
    echo "  1) Testar Health Check"
    echo "  2) Testar Domain Management"
    echo "  3) Testar Authentication"
    echo "  4) Testar Password Recovery"
    echo "  5) Testar Users"
    echo "  6) Testar MFA"
    echo "  7) Testar SSO"
    echo "  8) Executar TODOS os testes"
    echo "  0) Sair"
    echo ""
    read -p "Opção: " option
    
    case $option in
        1) test_health_check ;;
        2) test_domain_management ;;
        3) test_authentication ;;
        4) test_password_recovery ;;
        5) test_users ;;
        6) test_mfa ;;
        7) test_sso ;;
        8) 
            test_health_check
            test_domain_management
            test_authentication
            test_password_recovery
            test_users
            test_mfa
            test_sso
            ;;
        0) 
            echo "Saindo..."
            finish_test
            exit 0
            ;;
        *) 
            echo "Opção inválida"
            show_menu
            ;;
    esac
}

# ==============================================================================
# EXECUÇÃO
# ==============================================================================

main() {
    # Verificar se jq está instalado
    if ! command -v jq &> /dev/null; then
        print_error "jq não está instalado. Instale com: sudo apt-get install jq (ou equivalente)"
        exit 1
    fi
    
    # Verificar se curl está instalado
    if ! command -v curl &> /dev/null; then
        print_error "curl não está instalado. Instale com: sudo apt-get install curl (ou equivalente)"
        exit 1
    fi
    
    # Se argumentos foram passados, executar testes específicos
    if [ $# -gt 0 ]; then
        case "$1" in
            health) test_health_check ;;
            domains) test_domain_management ;;
            auth) test_authentication ;;
            password) test_password_recovery ;;
            users) test_users ;;
            mfa) test_mfa ;;
            sso) test_sso ;;
            all)
                test_health_check
                test_domain_management
                test_authentication
                test_password_recovery
                test_users
                test_mfa
                test_sso
                ;;
            *)
                echo "Uso: $0 [health|domains|auth|password|users|mfa|sso|all]"
                exit 1
                ;;
        esac
    else
        # Modo interativo
        while true; do
            show_menu
            echo ""
            read -p "Pressione Enter para continuar..."
        done
    fi
}

# Executar função principal
main "$@"
