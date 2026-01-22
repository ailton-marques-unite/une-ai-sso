# Exemplos de Uso da API - Domain Context

Este documento contém exemplos de como usar a API com Domain Context.

## Domain Context

O Domain Context pode ser fornecido de três formas:
1. **Header `x-domain-id`**: UUID do domínio
2. **Header `x-domain-slug`**: Slug do domínio (mais amigável)
3. **Query parameter `domain_id`**: UUID do domínio
4. **Query parameter `domain_slug`**: Slug do domínio

## 1. Criar Domínio (POST /domains)

**Não requer Domain Context** - usado para criar o primeiro domínio.

```bash
curl -X 'POST' \
  'http://localhost:3000/domains' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "Grupo Unite",
  "slug": "unite-group",
  "description": "Domínio principal da empresa"
}'
```

**Resposta esperada:**
```json
{
  "id": "uuid-do-dominio",
  "name": "Grupo Unite",
  "slug": "unite-group",
  "description": "Domínio principal da empresa",
  "is_active": true,
  "created_by": "uuid-do-criador",
  "created_at": "2026-01-21T16:00:00.000Z",
  "updated_at": "2026-01-21T16:00:00.000Z"
}
```

## 2. Listar Domínios (GET /domains)

**Requer Domain Context** - lista domínios no contexto do tenant.

### Usando Header x-domain-id

```bash
curl -X 'GET' \
  'http://localhost:3000/domains?page=1&limit=10&is_active=true' \
  -H 'accept: application/json' \
  -H 'x-domain-id: SEU-DOMAIN-UUID-AQUI'
```

### Usando Header x-domain-slug (Recomendado)

```bash
curl -X 'GET' \
  'http://localhost:3000/domains?page=1&limit=10&is_active=true' \
  -H 'accept: application/json' \
  -H 'x-domain-slug: unite-group'
```

### Usando Query Parameter domain_slug

```bash
curl -X 'GET' \
  'http://localhost:3000/domains?page=1&limit=10&is_active=true&domain_slug=unite-group' \
  -H 'accept: application/json'
```

### Usando Query Parameter domain_id

```bash
curl -X 'GET' \
  'http://localhost:3000/domains?page=1&limit=10&is_active=true&domain_id=SEU-DOMAIN-UUID-AQUI' \
  -H 'accept: application/json'
```

**Resposta esperada:**
```json
{
  "data": [
    {
      "id": "uuid-do-dominio",
      "name": "Grupo Unite",
      "slug": "unite-group",
      "description": "Domínio principal da empresa",
      "is_active": true,
      "created_by": "uuid-do-criador",
      "created_at": "2026-01-21T16:00:00.000Z",
      "updated_at": "2026-01-21T16:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

## 3. Obter Domínio por ID (GET /domains/:id)

**Requer Domain Context**

```bash
curl -X 'GET' \
  'http://localhost:3000/domains/SEU-DOMAIN-UUID-AQUI' \
  -H 'accept: application/json' \
  -H 'x-domain-slug: unite-group'
```

## 4. Obter Domínio por Slug (GET /domains/slug/:slug)

**Requer Domain Context**

```bash
curl -X 'GET' \
  'http://localhost:3000/domains/slug/unite-group' \
  -H 'accept: application/json' \
  -H 'x-domain-slug: unite-group'
```

## 5. Atualizar Domínio (PUT /domains/:id)

**Requer Domain Context**

```bash
curl -X 'PUT' \
  'http://localhost:3000/domains/SEU-DOMAIN-UUID-AQUI' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'x-domain-slug: unite-group' \
  -d '{
  "name": "Grupo Unite Atualizado",
  "description": "Nova descrição"
}'
```

## 6. Desativar Domínio (DELETE /domains/:id)

**Requer Domain Context**

```bash
curl -X 'DELETE' \
  'http://localhost:3000/domains/SEU-DOMAIN-UUID-AQUI' \
  -H 'accept: application/json' \
  -H 'x-domain-slug: unite-group'
```

## 7. Reativar Domínio (PATCH /domains/:id/activate)

**Requer Domain Context**

```bash
curl -X 'PATCH' \
  'http://localhost:3000/domains/SEU-DOMAIN-UUID-AQUI/activate' \
  -H 'accept: application/json' \
  -H 'x-domain-slug: unite-group'
```

## Fluxo Completo de Exemplo

### Passo 1: Criar o primeiro domínio

```bash
# Criar domínio (não precisa de domain context)
curl -X 'POST' \
  'http://localhost:3000/domains' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "Grupo Unite",
  "slug": "unite-group",
  "description": "Domínio principal da empresa"
}'
```

**Salve o `id` retornado para usar nos próximos passos.**

### Passo 2: Listar domínios usando o slug

```bash
# Listar domínios usando o slug no header
curl -X 'GET' \
  'http://localhost:3000/domains?page=1&limit=10' \
  -H 'accept: application/json' \
  -H 'x-domain-slug: unite-group'
```

### Passo 3: Obter detalhes do domínio

```bash
# Obter detalhes usando o slug no header
curl -X 'GET' \
  'http://localhost:3000/domains/slug/unite-group' \
  -H 'accept: application/json' \
  -H 'x-domain-slug: unite-group'
```

## Notas Importantes

1. **Headers são preferidos sobre query parameters** para Domain Context, pois são mais seguros e não aparecem nos logs de servidor.

2. **x-domain-slug é mais amigável** que x-domain-id, mas ambos funcionam igualmente.

3. **Domain Context é obrigatório** em todas as rotas exceto:
   - `POST /domains` (criação do primeiro domínio)
   - `GET /health` (health checks)

4. **Rate Limiting** é aplicado por domínio, então cada domínio tem seus próprios limites.

5. **O domínio deve estar ativo** (`is_active: true`) para ser usado no Domain Context.

## Erros Comuns

### Erro: Domain context is required

**Causa**: Não foi fornecido domain_id ou domain_slug.

**Solução**: Adicione um dos headers ou query parameters mencionados acima.

### Erro: Domain not found

**Causa**: O domain_id ou domain_slug fornecido não existe ou está inativo.

**Solução**: Verifique se o domínio existe e está ativo usando `GET /domains` sem domain context (após criar).

### Erro: ThrottlerException: Too Many Requests (429)

**Causa**: Você atingiu o limite de rate limiting configurado.

**Solução**: 
1. **Durante desenvolvimento**: Limpe as chaves do Redis:
   ```bash
   # Usando o script fornecido
   ./scripts/clear-throttler.sh
   
   # Ou manualmente via redis-cli
   redis-cli --scan --pattern "throttler:*" | xargs redis-cli DEL
   redis-cli --scan --pattern "rl:*" | xargs redis-cli DEL
   ```

2. **Aumentar limite em desenvolvimento**: Configure `RATE_LIMIT_MAX_REQUESTS_DEV` no `.env`:
   ```bash
   RATE_LIMIT_MAX_REQUESTS_DEV=1000
   ```

3. **Aguardar**: O limite é resetado automaticamente após o TTL configurado (padrão: 15 minutos).

**Limites configurados**:
- **Default** (desenvolvimento): 1000 requisições/minuto
- **Default** (produção): 5 requisições/15 minutos
- **Domains**: 100 requisições/minuto
- **Login**: 5 tentativas/15 minutos
- **Register**: 3 tentativas/hora
