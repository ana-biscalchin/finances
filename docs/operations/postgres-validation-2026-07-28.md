# Validação PostgreSQL — 2026-07-28

## Escopo

- Projeto Neon de staging: `morning-math-16002339`.
- Banco: `neondb`.
- Branch temporário de validação: `br-misty-base-avviu9j0`, removido sem promover a migration bruta.
- Branch principal de staging: `br-bold-hill-avumh96d`.
- Nenhum dado pessoal foi usado; todos os registros de teste são sintéticos e removíveis.
- Produção `fancy-breeze-38883964` não foi acessada para escrita.

## Resultado

- Baseline PostgreSQL criada em branch temporário: 19 tabelas de aplicação, 42 relações e índices de ownership.
- Dez raízes financeiras possuem `owner_id` obrigatório.
- Readiness, criação/listagem de conta e rollback foram validados diretamente no Neon.
- A matriz ampliada passou 4/4 cenários no Neon: rota financeira escopada, workflow canônico, rollback e concorrência/unicidade com duas proprietárias.
- O workflow canônico percorreu categorias/subcategorias, contas e meios associados, cartão, lançamento, planejamento, recorrência confirmada, transferência, controle mensal e relatório.
- A CI aplica a baseline em PostgreSQL vazio, reaplica o migrador para provar idempotência e executa a mesma matriz financeira.

## Promoção concluída

Após confirmação explícita:

- a branch temporária foi descartada sem aplicar seu SQL bruto;
- a baseline versionada do Drizzle foi aplicada no branch principal de staging;
- uma segunda execução do migrador terminou sem recriar objetos, comprovando idempotência;
- o staging ficou com 19 tabelas de aplicação, 42 FKs e uma entrada no journal do Drizzle;
- `platform_proof`, criado na validação anterior, permaneceu preservado;
- a matriz financeira PostgreSQL passou 4/4 cenários contra o branch principal;
- `/`, `/health/live` e `/health/ready` responderam `200` no Render.

O projeto Neon de produção `fancy-breeze-38883964` permaneceu fora do escopo e não foi alterado.
