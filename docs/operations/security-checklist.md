# Checklist de hardening — T13

- Produção usa HTTPS, cookie `HttpOnly`/`Secure`/`SameSite=Lax` e origens CORS explícitas.
- Mutations exigem uma origem confiável; requisições cross-site são rejeitadas.
- Helmet fornece CSP, `nosniff`, frame protection e HSTS em produção.
- Login tem rate limit de 5 tentativas por minuto; payloads têm limite de 1 MiB.
- Logs redigem autorização, cookies, senhas, CSV e listas de transações.
- Exportações CSV neutralizam valores iniciados por `=`, `+`, `-`, `@` ou tabulação.
- Exportação JSON é autenticada, limitada ao proprietário e enviada com `no-store`.
- Configuração de produção rejeita secrets do Google Drive e exige PostgreSQL.
- Upload/importação aceita apenas o payload limitado e passa por validação de schema.

Antes do go-live, executar `pnpm check`, revisar `pnpm audit --prod` e confirmar o
checklist de dependências/imagem no provedor.
