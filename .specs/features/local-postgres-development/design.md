# Design

`compose.yaml` fornece PostgreSQL 17 com volume persistente, bind somente em loopback e healthcheck. `scripts/dev-postgres.mjs` sobe e aguarda o serviço, força uma URL local conhecida no processo filho, aplica migrations/seed e inicia web + API. `DATABASE_URL` do `.env` não participa do fluxo local.

O override `LOCAL_DATABASE_URL` existe apenas para outra instância PostgreSQL local. O fluxo não cria, altera nem exclui recursos Neon.
