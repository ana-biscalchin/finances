# Autenticação privada

A T5 introduz login próprio sem cadastro público. Senhas usam Argon2id; tokens de sessão são aleatórios, persistidos somente como HMAC-SHA-256 e enviados em cookie `HttpOnly`, `Secure` em produção e `SameSite=Lax`.

## Bootstrap local

1. Em banco local antigo, aplique primeiro `pnpm db:migrate:identity` para criar somente a estrutura de identidade. Em banco vazio, esta etapa também é segura e idempotente.
2. Defina somente o identificador não secreto: `export BOOTSTRAP_USERNAME=ana`.
3. Leia a senha sem eco e envie pela entrada padrão:

```bash
read -r -s BOOTSTRAP_PASSWORD
printf '%s' "$BOOTSTRAP_PASSWORD" | pnpm --filter @finances/api auth:bootstrap
unset BOOTSTRAP_PASSWORD
```

4. Execute o backfill com a mesma identidade explícita: `MIGRATION_OWNER_USERNAME=ana pnpm db:migrate`.
5. Execute os seeds, se necessários, com `SEED_OWNER_USERNAME=ana pnpm db:seed`.

O comando é idempotente: se a usuária já existir, não altera senha ou sessões. A senha nunca deve ser colocada em argumento, arquivo versionado ou log. O bootstrap hospedado será habilitado sobre PostgreSQL na T8; até lá, este comando opera somente no SQLite local configurado por `DATABASE_PATH`.

## Sessão e resposta a incidente

- Expiração absoluta padrão: 7 dias.
- Expiração por inatividade padrão: 24 horas.
- Login: máximo de 5 tentativas por minuto por origem, além de atraso progressivo.
- Logout revoga a sessão no banco.
- Mudança de senha exige a senha atual, revoga todas as sessões anteriores e cria uma nova.
- Em suspeita de comprometimento, altere a senha e rotacione `SESSION_SECRET`; a rotação invalida todos os cookies existentes.
