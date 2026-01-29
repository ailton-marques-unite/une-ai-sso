---
name: Corrigir Autenticação PostgreSQL Docker
overview: Corrigir o erro de autenticação do PostgreSQL no Docker Compose, resolvendo inconsistências entre variáveis de ambiente, garantindo que o PostgreSQL seja inicializado corretamente e que o script de inicialização aguarde adequadamente.
todos:
  - id: fix-docker-compose
    content: "Corrigir docker-compose.yml: adicionar env_file ao postgres, ajustar valores padrão e healthcheck"
    status: completed
  - id: improve-init-script
    content: Melhorar docker-init-db.sh com timeout e melhor tratamento de erros
    status: completed
  - id: verify-env-file
    content: Verificar se arquivo .env existe e tem variáveis corretas
    status: completed
  - id: test-docker-setup
    content: "Testar configuração Docker: parar containers, limpar volumes se necessário, reconstruir e verificar logs"
    status: completed
isProject: false
---

# Plano para Corrigir Erro de Autenticação PostgreSQL no Docker

## Análise do Problema

O erro indica que o role "postgres" não existe no PostgreSQL:

```
FATAL: password authentication failed for user "postgres"
DETAIL: Role "postgres" does not exist.
```

### Causas Identificadas:

1. **Inconsistência de valores padrão**:
  - `docker-compose.yml` usa `postgres` como padrão
  - Código da aplicação (`typeorm.config.ts`, `data-source.ts`) usa `postgres_uneaisso` como padrão
  - Documentação sugere `postgres_uneaisso` e `postgres_UneA1Ss0`
2. **Volume persistente pode ter dados antigos**: O volume `postgres_data` pode ter sido criado com configurações diferentes anteriormente
3. **Script de inicialização**: O `docker-init-db.sh` pode estar tentando conectar antes do PostgreSQL criar o usuário inicial
4. **Healthcheck pode estar falhando**: O healthcheck usa variáveis de ambiente que podem não estar definidas corretamente

## Estratégia de Correção

### Arquivos a Modificar:

1. `[docker-compose.yml](docker-compose.yml)`: Ajustar variáveis de ambiente e healthcheck
2. `[docker-init-db.sh](docker-init-db.sh)`: Melhorar lógica de espera e tratamento de erros
3. Possivelmente limpar volumes antigos (instruções no plano)

### Implementação:

1. **Corrigir docker-compose.yml**
  - Garantir que o serviço `postgres` use variáveis de ambiente consistentes
  - Adicionar `env_file: .env` ao serviço postgres para ler variáveis do arquivo .env
  - Ajustar healthcheck para usar variáveis corretas
  - Garantir que o serviço postgres não dependa de variáveis não definidas
2. **Melhorar docker-init-db.sh**
  - Adicionar tratamento de erro mais robusto
  - Melhorar a mensagem de espera para incluir informações de debug
  - Adicionar timeout máximo para evitar loop infinito
  - Verificar se o usuário existe antes de tentar conectar
3. **Sincronizar valores padrão**
  - Usar os mesmos valores padrão em todos os lugares
  - Recomendar usar `postgres_uneaisso` e `postgres_UneA1Ss0` conforme documentação
4. **Instruções para limpar volumes (se necessário)**
  - Comando para remover volumes antigos: `docker-compose down -v`
  - Reconstruir containers: `docker-compose up --build`

## Mudanças Específicas

### docker-compose.yml

```yaml
postgres:
  image: postgres:15-alpine
  container_name: une-ai-sso-postgres
  env_file:
    - .env
  environment:
    POSTGRES_DB: ${DATABASE_NAME:-une_ai_sso}
    POSTGRES_USER: ${DATABASE_USER:-postgres_uneaisso}
    POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-postgres_UneA1Ss0}
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USER:-postgres_uneaisso} -d ${DATABASE_NAME:-une_ai_sso}"]
```

### docker-init-db.sh

Melhorar o script para:

- Adicionar timeout máximo (ex: 60 segundos)
- Melhorar mensagens de erro
- Verificar se o banco está realmente pronto antes de tentar criar o database

## Ordem de Execução

1. Parar containers atuais: `docker-compose down`
2. Remover volumes (se necessário): `docker-compose down -v`
3. Aplicar mudanças nos arquivos
4. Reconstruir e iniciar: `docker-compose up --build`
5. Verificar logs: `docker-compose logs postgres`

## Notas Importantes

- Se o arquivo `.env` não existir ou não tiver as variáveis definidas, os valores padrão serão usados
- A remoção de volumes (`-v`) apagará todos os dados do banco - use com cuidado em produção
- O healthcheck precisa esperar o PostgreSQL criar o usuário antes de marcar como saudável

## Resumo das correções implementadas
1. Correções no docker-compose.yml
> Adicionado env_file: .env ao serviço postgres para ler variáveis do arquivo .env
Ajustados valores padrão:
POSTGRES_USER: de postgres para postgres_uneaisso
POSTGRES_PASSWORD: de postgres para postgres_UneA1Ss0
Ajustado healthcheck para usar o usuário e banco corretos
Ajustados valores padrão no serviço une-ai-sso-service para consistência
2. Melhorias no docker-init-db.sh
> Adicionado timeout máximo de 60 segundos para evitar loop infinito
Melhoradas mensagens de log com informações de debug
Ajustados valores padrão para postgres_uneaisso e postgres_UneA1Ss0
Adicionado tratamento de erro para timeout
3. Verificação do arquivo .env
> Arquivo .env existe
Variáveis DATABASE_* não estão definidas no .env, então os valores padrão serão usados
Configuração validada: POSTGRES_USER=postgres_uneaisso e POSTGRES_PASSWORD=postgres_UneA1Ss0

### Próximos passos
Para aplicar as correções e testar:
#### 1. Parar containers (se estiverem rodando)docker-compose down
#### 2. Se você tiver dados antigos no volume que causam conflito, remova o volume:docker-compose down -v
#### 3. Reconstruir e iniciar os containersdocker-compose up --build
#### 4. Verificar logs do PostgreSQLdocker-compose logs postgres# 5. Verificar logs do serviço da aplicaçãodocker-compose logs une-ai-sso-service

