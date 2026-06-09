# Memoria Do Projeto Para Agentes

Este arquivo resume o contexto do projeto para futuras sessoes de Codex/agentes.

## Identidade Do Projeto

- Nome do repo remoto: `ana-biscalchin/finances`.
- Caminho local atual: `/home/ana/financas`.
- Objetivo: app local de financas pessoais.
- Status atual: app local em desenvolvimento com nucleos de contas, categorias, lancamentos, faturas, controle mensal, importacao CSV e relatorios iniciais implementados.

## Stack Decidida

- Frontend: React + TypeScript + Vite.
- UI: Mantine.
- Backend/API local: Node.js + Fastify.
- Banco: SQLite local.
- ORM/migrations: Drizzle.
- Gerenciador de pacotes: pnpm (workspaces).
- Graficos: Recharts.
- Icones: Tabler Icons.
- Empacotamento futuro: Electron.

## Principios Importantes

- Manter como web app local em `localhost`.
- Preparar arquitetura para Electron, sem comecar por Electron.
- Banco local no inicio, com backups simples.
- Controle mensal e a tela central do app.
- Relatorios devem ser bonitos, claros e explicativos.
- Categorias e subcategorias devem ser gerenciaveis e renomeaveis.
- Meios de pagamento sao hardcoded/semeados e nao precisam de CRUD.
- Arquivar registros nao e excluir; quando aplicavel, deve existir caminho de restauracao.
- Historico de categorias deve usar IDs internos, nao nomes textuais.
- Transferencias entre contas nao entram como despesa.
- Pagamento de fatura de cartao nao duplica despesa.
- Compras no cartao mantem data da compra e impactam o orcamento pelo mes de vencimento da fatura.
- Reservas sao tratadas como caixinhas/objetivos simples, com aportes, resgates, rendimentos e ajustes.
- Importacao/exportacao: CSV implementado. OFX ainda e melhoria futura. JSON nao esta no escopo atual.

## Documentos De Referencia

- `README.md`: visao geral do projeto.
- `docs/regras-negocio.md`: regras de negocio atuais.
- `docs/regras-cartao.md`: regras especificas de cartao e fatura.
- `docs/decisoes-tecnicas.md`: stack e decisoes tecnicas.
- `docs/modulos.md`: modulos funcionais.
- `docs/categorias.md`: taxonomia inicial de categorias.
- `docs/orientacao-importacao-csv.md`: guia de importacao CSV.
- `docs/visual-usabilidade.md`: direcao visual e UX.
- `docs/criterios-qualidade.md`: regras para avaliar codigo, especialmente codigo gerado por IA.
- `TODO.md`: backlog e status.

## Estrutura Do Projeto

Estrutura atual:

```text
apps/
├─ web/
└─ api/
packages/
├─ database/
├─ domain/
└─ shared/
data/
docs/
```

Manter separacao entre UI, API, banco e dominio.

## Decisoes Ainda Abertas

- Paleta de cores.
- Modo claro/escuro.
- Estrategia exata de backups.
- Estrategia de leitura OFX.
- API/UI de reservas.

## Como Trabalhar Neste Repo

- Antes de implementar regra financeira, consultar `docs/regras-negocio.md`.
- Antes de aceitar codigo gerado por IA, consultar `docs/criterios-qualidade.md`.
- Registrar decisoes novas em `docs/`.
- Manter `TODO.md` atualizado conforme as tarefas forem concluidas.
- Preferir commits pequenos por etapa funcional.
- Nao apagar historico ou conteudo sem confirmacao explicita.
- Nao commitar banco SQLite local, backups, `.env` ou artefatos de build.

## Encerramento De Tarefas

Ao terminar uma etapa de desenvolvimento, sempre responder com:

- Features que precisam ser testadas visualmente.
- O que o app ja e capaz de fazer.
- Quais testes unitarios foram implementados/executados.
- Quais comandos de verificacao foram rodados.
- URL local para revisao.

Quando houver app visual para revisar, deixar `pnpm dev` rodando em segundo plano para a usuaria abrir o app.
