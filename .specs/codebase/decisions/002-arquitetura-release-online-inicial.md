# ADR 002 — Arquitetura do release online inicial

- **Status:** aceita
- **Data:** 2026-07-27
- **Responsável pela decisão:** Ana

## Contexto

O ADR 001 definiu a distribuição exclusivamente online, mas deixou em aberto acesso, autenticação, hospedagem, banco, domínio, região e Google Drive. Para o primeiro release, simplicidade e custo baixo têm prioridade sobre disponibilidade contínua, escala e conveniências futuras.

## Decisão

- Somente Ana terá acesso inicialmente; não haverá cadastro público nem convite de outras pessoas.
- A autenticação será própria, com usuário e senha armazenados no PostgreSQL. Somente o hash seguro da senha será persistido; nunca a senha em texto aberto ou reversível.
- Não existirá endpoint público de cadastro. A primeira usuária será criada por comando operacional idempotente e a senha será fornecida por entrada segura/secret, sem seed versionado.
- A sessão será opaca, armazenada no servidor e enviada em cookie `HttpOnly`, `Secure` e `SameSite=Lax`. Tokens de sessão também serão persistidos somente como hash.
- O app será hospedado inicialmente em um **Render Free Web Service**. O Fastify servirá a API e os artefatos do React/Vite na mesma origem fornecida pelo Render.
- O banco de produção será **Neon Free PostgreSQL**, acessado com conexão TLS e secret configurado no Render.
- Não haverá domínio próprio inicialmente; será usada a URL gratuita `*.onrender.com` atribuída ao serviço.
- Região não é requisito do release inicial. API e banco devem, quando as opções gratuitas permitirem, ficar em regiões próximas para reduzir latência.
- Google Drive será removido da interface e da API do release online inicial.
- Login Google/OAuth, multiusuário e domínio próprio ficam no backlog.
- Planos gratuitos podem mudar ou deixar de existir. Antes da implementação, a prova de implantação deve confirmar limites, política de suspensão, persistência, conexões, backups e custos vigentes. Se uma opção gratuita se tornar inviável, deve-se preferir o menor plano pago equivalente, mediante nova aprovação.

## Segurança mínima da autenticação própria

- hash de senha com Argon2id e parâmetros registrados/configuráveis;
- verificação em tempo aproximadamente constante pela biblioteca;
- rate limiting e atraso progressivo no login;
- resposta genérica para usuário inexistente ou senha incorreta;
- rotação da sessão após login e mudança de senha;
- expiração absoluta e por inatividade;
- proteção CSRF/origin nas mutações;
- mudança de senha autenticada; recuperação automatizada de senha fica fora do primeiro release;
- logs nunca contêm usuário completo, senha, hash, cookie ou token de sessão.

## Consequências

### Positivas

- custo inicial pode permanecer zero dentro dos limites dos planos escolhidos;
- apenas dois serviços externos são necessários;
- mesma origem simplifica deploy, cookies, CORS e CSRF;
- não há dependência de provedor de identidade nem configuração OAuth no release inicial;
- PostgreSQL prepara a persistência para evolução futura.

### Negativas e riscos aceitos

- serviços gratuitos não oferecem a mesma disponibilidade ou garantias de planos pagos;
- o serviço pode sofrer cold start/suspensão e a primeira abertura pode ser lenta;
- a aplicação assume responsabilidade por hashing, sessão, rate limiting e mudança de senha;
- sem recuperação automatizada, perda de senha exige procedimento operacional;
- sem domínio próprio, a URL fica vinculada ao Render;
- mudanças nos planos gratuitos podem exigir migração ou custo mensal;
- Google Drive deixa de funcionar até eventual reimplementação futura.

## Alternativas rejeitadas neste release

- provedor de identidade gerenciado: mais uma integração e potencial custo para um único acesso;
- SQLite em volume persistente: maior acoplamento à instância e recuperação mais frágil;
- VPS própria: carga operacional incompatível com a prioridade de simplicidade;
- frontend e API em serviços separados: mais configuração de CORS, cookies e deploy;
- OAuth Google e multiusuário: valor insuficiente para o primeiro release privado.
