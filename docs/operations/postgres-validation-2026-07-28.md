# Validação PostgreSQL — 2026-07-28

## Escopo

- Projeto Neon de staging: `morning-math-16002339`.
- Banco: `neondb`.
- Branch temporário: `br-misty-base-avviu9j0`.
- Nenhum dado pessoal foi usado; todos os registros de teste são sintéticos e removíveis.
- Produção `fancy-breeze-38883964` não foi acessada para escrita.

## Resultado

- Baseline PostgreSQL criada em branch temporário: 19 tabelas de aplicação, 42 relações e índices de ownership.
- Dez raízes financeiras possuem `owner_id` obrigatório.
- Readiness, criação/listagem de conta e rollback foram validados diretamente no Neon.
- A matriz ampliada passou 4/4 cenários no Neon: rota financeira escopada, workflow canônico, rollback e concorrência/unicidade com duas proprietárias.
- O workflow canônico percorreu categorias/subcategorias, contas e meios associados, cartão, lançamento, planejamento, recorrência confirmada, transferência, controle mensal e relatório.
- A CI aplica a baseline em PostgreSQL vazio, reaplica o migrador para provar idempotência e executa a mesma matriz financeira.

## Promoção pendente

O branch principal de staging não foi alterado. A promoção exige confirmação explícita, validação do método controlado de migration e smoke posterior. O branch de produção continua fora de escopo.
