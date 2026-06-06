# TODO

Lista inicial para comecar o codigo do projeto.

## Agora

- [ ] Decidir gerenciador de pacotes: `pnpm`, `npm workspaces` ou outro.
- [ ] Confirmar estrutura inicial do workspace.
- [ ] Criar scaffold do monorepo/local workspace.
- [ ] Configurar scripts raiz para `typecheck`, `lint`, `test` e `build`.
- [ ] Definir comando unico de verificacao local, por exemplo `check`.
- [ ] Garantir que toda tarefa de codigo passe pelo loop fechado: typecheck, lint, testes relevantes e build.
- [ ] Criar `apps/web` com Vite + React + TypeScript.
- [ ] Instalar e configurar Mantine no frontend.
- [ ] Criar layout base do app com navegacao e telas vazias.
- [ ] Criar `apps/api` com Fastify + TypeScript.
- [ ] Criar rota `GET /health`.
- [ ] Configurar CORS entre web e API local.
- [ ] Criar scripts raiz para rodar web e API.

## Banco E Dominio

- [ ] Criar pacote `packages/domain`.
- [ ] Criar pacote `packages/shared`.
- [ ] Criar pacote `packages/database`.
- [ ] Configurar SQLite.
- [ ] Configurar Drizzle.
- [ ] Criar primeira migration.
- [ ] Definir convencao de dinheiro em centavos.
- [ ] Definir helpers de datas: `YYYY-MM-DD` e `YYYY-MM`.
- [ ] Criar tabelas iniciais de contas, meios de pagamento e categorias.
- [ ] Criar seed de meios de pagamento brasileiros.
- [ ] Criar seed das categorias iniciais.
- [ ] Criar primeiros testes unitarios para helpers de dinheiro e datas.

## Primeiros Modulos

- [ ] Implementar CRUD de contas.
- [ ] Testar CRUD de contas na API.
- [ ] Implementar CRUD de meios de pagamento.
- [ ] Implementar CRUD completo de categorias, grupos, macros e micros.
- [ ] Implementar arquivamento de categorias.
- [ ] Implementar renomeacao preservando historico por ID.
- [ ] Implementar fusao de categorias duplicadas.
- [ ] Testar regras de arquivamento, renomeacao e fusao de categorias.
- [ ] Implementar CRUD de lancamentos.
- [ ] Implementar transferencias entre contas.
- [ ] Testar que transferencias nao entram como gasto.

## Cartao E Controle Mensal

- [ ] Implementar cadastro de cartoes de credito.
- [ ] Implementar faturas por mes de vencimento.
- [ ] Implementar compras no cartao com data da compra e data de impacto.
- [ ] Implementar parcelamentos.
- [ ] Implementar quitacao de fatura sem duplicar despesa.
- [ ] Testar regra de cartao por vencimento da fatura.
- [ ] Testar que quitacao de fatura nao duplica despesa.
- [ ] Criar agregacao do controle mensal.
- [ ] Testar calculo de orcado, comprometido, realizado e disponivel.
- [ ] Criar primeira tela do controle mensal.

## Reservas, Relatorios E Dados

- [ ] Implementar reservas/caixinhas simples.
- [ ] Implementar movimentacoes de reserva: aporte, resgate, rendimento e ajuste.
- [ ] Testar calculo de saldo, aportes, resgates e rendimentos de reservas.
- [ ] Criar dashboard inicial.
- [ ] Criar primeiros graficos com Recharts.
- [ ] Criar exportacao CSV.
- [ ] Planejar importacao CSV.
- [ ] Planejar importacao OFX.
- [ ] Criar backup manual do SQLite.

## Qualidade

- [ ] Configurar testes unitarios.
- [ ] Configurar testes de API.
- [ ] Configurar verificacao de build.
- [ ] Documentar no README os comandos de desenvolvimento e verificacao.
- [ ] Testar regra de cartao por vencimento da fatura.
- [ ] Testar que pagamento de fatura nao duplica despesa.
- [ ] Testar que transferencia nao entra como gasto.
- [ ] Testar renomeacao de categoria preservando historico.
- [ ] Testar fusao de categorias.
- [ ] Testar backup para nao sobrescrever dados sem confirmacao.
- [ ] Manter diffs pequenos e revisar tarefas acima de 1000 linhas com mais rigor.
