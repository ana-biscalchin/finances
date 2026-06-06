# Memoria Do Projeto Para Agentes

Este arquivo resume o contexto do projeto para futuras sessoes de Codex/agentes.

## Identidade Do Projeto

- Nome do repo remoto: `ana-biscalchin/finances`.
- Caminho local atual: `/home/ana/financas`.
- Objetivo: app local de financas pessoais.
- Status atual: planejamento tecnico e funcional concluido o suficiente para iniciar scaffold.

## Stack Decidida

- Frontend: React + TypeScript + Vite.
- UI: Mantine.
- Backend/API local: Node.js + Fastify.
- Banco: SQLite local.
- ORM/migrations: Drizzle.
- Tabelas densas: TanStack Table.
- Graficos: Recharts.
- Icones: Tabler Icons ou Lucide, decisao final em aberto.
- Empacotamento futuro: Electron.

## Principios Importantes

- Comecar como web app local em `localhost`.
- Preparar arquitetura para Electron, sem comecar por Electron.
- Banco local no inicio, com backups simples.
- Controle mensal e a tela central do app.
- Relatorios devem ser bonitos, claros e explicativos.
- Categorias, grupos, macros e micros devem ser gerenciaveis e renomeaveis.
- Historico de categorias deve usar IDs internos, nao nomes textuais.
- Transferencias entre contas nao entram como despesa.
- Pagamento de fatura de cartao nao duplica despesa.
- Compras no cartao mantem data da compra e impactam o orcamento pelo mes de vencimento da fatura.
- Reservas sao tratadas como caixinhas/objetivos simples, com aportes, resgates, rendimentos e ajustes.
- Importacao/exportacao: CSV e OFX. JSON nao esta no escopo atual.

## Documentos De Referencia

- `README.md`: visao geral do projeto.
- `docs/decisoes-tecnicas.md`: stack e decisoes tecnicas.
- `docs/modulos.md`: modulos funcionais.
- `docs/categorias.md`: taxonomia inicial de categorias.
- `docs/visual-usabilidade.md`: direcao visual e UX.
- `docs/plano-implementacao.md`: etapas de implementacao.
- `TODO.md`: lista de tarefas inicial.

## Estrutura Planejada

Estrutura sugerida para o inicio do codigo:

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

- Gerenciador de pacotes.
- Estrutura final do workspace.
- Biblioteca final de icones.
- Paleta de cores.
- Modo claro/escuro.
- Estrategia exata de backups.
- Layouts de CSV suportados.
- Estrategia de leitura OFX.

## Como Trabalhar Neste Repo

- Antes de implementar, consultar `docs/plano-implementacao.md`.
- Registrar decisoes novas em `docs/`.
- Manter `TODO.md` atualizado conforme as tarefas forem concluidas.
- Preferir commits pequenos por etapa funcional.
- Nao apagar historico ou conteudo sem confirmacao explicita.
- Nao commitar banco SQLite local, backups, `.env` ou artefatos de build.
