# TODO

Lista inicial para comecar o codigo do projeto.

## Agora

- [x] Decidir gerenciador de pacotes: `pnpm`, `npm workspaces` ou outro.
- [x] Confirmar estrutura inicial do workspace.
- [x] Criar scaffold do monorepo/local workspace.
- [x] Configurar scripts raiz para `typecheck`, `lint`, `test` e `build`.
- [x] Definir comando unico de verificacao local, por exemplo `check`.
- [x] Garantir que toda tarefa de codigo passe pelo loop fechado: typecheck, lint, testes relevantes e build.
- [x] Criar `apps/web` com Vite + React + TypeScript.
- [x] Instalar e configurar Mantine no frontend.
- [x] Criar layout base do app com navegacao e telas vazias.
- [x] Criar `apps/api` com Fastify + TypeScript.
- [x] Criar rota `GET /health`.
- [x] Configurar CORS entre web e API local.
- [x] Criar scripts raiz para rodar web e API.

## Banco E Dominio

- [x] Criar pacote `packages/domain`.
- [x] Criar pacote `packages/shared`.
- [x] Criar pacote `packages/database`.
- [x] Configurar SQLite.
- [x] Configurar Drizzle.
- [x] Criar primeira migration.
- [x] Definir convencao de dinheiro em centavos.
- [x] Definir helpers de datas: `YYYY-MM-DD` e `YYYY-MM`.
- [x] Criar tabelas iniciais de contas, meios de pagamento e categorias.
- [x] Criar seed de meios de pagamento brasileiros.
- [x] Criar seed das categorias iniciais.
- [x] Criar primeiros testes unitarios para helpers de dinheiro e datas.

## Primeiros Modulos

- [x] Implementar CRUD de contas.
- [x] Testar CRUD de contas na API.
- [x] Implementar restauracao de contas arquivadas.
- [x] Padronizar validacao de contas na API com erro 400.
- [ ] Planejar exclusao definitiva de contas como acao separada do arquivamento.
- [x] Confirmar lista final hardcoded de meios de pagamento.
- [ ] Expor meios de pagamento hardcoded para uso em lancamentos e orcamento.
- [x] Implementar CRUD completo de categorias, grupos, macros e micros.
- [x] Implementar arquivamento de categorias.
- [x] Implementar renomeacao preservando historico por ID.
- [ ] Implementar fusao de categorias duplicadas.
- [x] Testar regras de arquivamento e renomeacao de categorias.
- [ ] Testar regra de fusao de categorias.
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

- [x] Configurar testes unitarios.
- [ ] Configurar testes de API.
- [x] Configurar verificacao de build.
- [x] Documentar no README os comandos de desenvolvimento e verificacao.
- [ ] Testar regra de cartao por vencimento da fatura.
- [ ] Testar que pagamento de fatura nao duplica despesa.
- [ ] Testar que transferencia nao entra como gasto.
- [ ] Testar renomeacao de categoria preservando historico.
- [ ] Testar fusao de categorias.
- [ ] Testar backup para nao sobrescrever dados sem confirmacao.
- [ ] Manter diffs pequenos e revisar tarefas acima de 1000 linhas com mais rigor.
