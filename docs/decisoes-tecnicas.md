# Decisoes Tecnicas

Este documento registra as decisoes tecnicas do projeto e deve servir como base para as proximas discussoes de arquitetura, produto e implementacao.

## Objetivo Do Projeto

Criar um app local para gerenciamento de financas pessoais, com banco de dados simples, boa experiencia de uso e possibilidade futura de empacotamento como aplicativo desktop.

## Decisoes Ja Tomadas

### Modelo Do App

O projeto e um web app local, rodando em `localhost`.

Essa escolha reduz complexidade, facilita validacao do produto e permite evoluir a arquitetura antes de empacotar tudo como desktop.

### Frontend

Stack escolhida:

- React
- TypeScript
- Vite

Motivos:

- Vite e leve, rapido e adequado para um frontend local.
- React oferece boa base para interfaces ricas.
- TypeScript ajuda a manter modelos financeiros e fluxos de dados mais seguros.

### Backend/API

Stack escolhida:

- Node.js
- Fastify

Motivos:

- Fastify cumpre papel parecido com Express, mas com melhor suporte moderno a TypeScript.
- A API local deixa regras de negocio e acesso ao banco separados da interface.
- Essa separacao facilita uma futura migracao para Electron.

### Banco De Dados

Banco escolhido:

- SQLite local

Motivos:

- Arquivo unico e simples de versionar por backup.
- Excelente para uso pessoal e baixo volume.
- Evita dependencia inicial de servicos web gratuitos.
- Mantem os dados financeiros sob controle local.

### Camada De Banco

Opcao preferida:

- Drizzle ORM

Motivos:

- Tipagem boa com TypeScript.
- Migrations controladas.
- Menos pesado que alternativas mais amplas.
- Combina bem com SQLite e API Node local.

### Empacotamento Futuro

Direcao escolhida:

- Electron no futuro

Motivos:

- Permite empacotar frontend, backend local e SQLite em um unico app desktop.
- Mantem o projeto principalmente em TypeScript/JavaScript.
- E mais natural para embutir Node, Fastify e SQLite do que Tauri.

### Biblioteca Visual

Biblioteca escolhida:

- Mantine

Motivos:

- Boa integracao com React, TypeScript e Vite.
- Componentes prontos para formularios, filtros, modais, dashboards e telas densas.
- Visual moderno e pragmatico para um app pessoal de financas.

Bibliotecas complementares em uso:

- Recharts para graficos.
- Tabler Icons para icones.

### Estrutura e Gerenciamento

Decisoes sobre o workspace:

- Gerenciador de pacotes: `pnpm` com workspaces.
- Estrutura de pastas: monorepo com `apps/` (web, api) e `packages/` (database, domain, shared).

### Modelo Atual de Entidades

O modelo de entidades financeiras foi definido em SQLite usando Drizzle, com entidades para contas, meios de pagamento, categorias, subcategorias, transacoes, cartoes, faturas, parcelamentos, orcamentos e reservas.

Transferencias nao usam uma tabela propria: a implementacao atual usa pares de `transactions` vinculados por `linkedTransactionId`.

## Arquitetura Alvo Inicial

```text
React/Vite UI -> Fastify API local -> SQLite local
```

Durante o desenvolvimento local:

```text
localhost:5173  frontend Vite
localhost:3000  backend Fastify
./data/financas.sqlite  banco SQLite
```

## Arquitetura Futura Com Electron

```text
Electron app
├─ React/Vite renderer
├─ Node/Fastify ou camada interna no main process
└─ SQLite local
```

A arquitetura inicial deve evitar acoplamento desnecessario para que o empacotamento com Electron seja uma evolucao natural, nao uma reescrita.

## Banco Local Versus Banco Na Web

Decisao atual:

- Manter banco local no inicio.
- Planejar backups simples desde cedo.
- Considerar banco remoto apenas se houver necessidade real de acessar de varios dispositivos ou sincronizar dados.

Opcoes futuras avaliadas:

- Neon Postgres
- Supabase Postgres
- Turso/libSQL

Observacao: servicos gratuitos podem ter limites, pausas, ausencia de backups automaticos ou mudancas de politica. Para dados financeiros pessoais, o banco local com backups simples e uma escolha mais previsivel no inicio.

## Estratégia de Backups

Decisão atual:

- Utilizar a API de Backup Online nativa do SQLite via `better-sqlite3` para realizar backups e restaurações de forma consistente, sem risco de corrupção ou perda de dados.
- Armazenar backups no diretório `data/backups/` com data/hora no nome.
- Criar backup automático `pre-restore-` imediatamente antes de cada restauração para garantir recuperação segura.

### Arquivos e nomenclatura

- Backup manual: `backup-YYYY-MM-DD-HHmmss.sqlite`.
- Ponto anterior à restauração: `pre-restore-YYYY-MM-DD-HHmmss.sqlite`.
- Banco e backups ficam em `data/`, fora do versionamento.

### Segurança da criação e restauração

- O banco usa WAL; por isso o arquivo ativo não deve ser copiado diretamente.
- A criação usa `db.backup(destinationPath)` para obter uma cópia transacional consistente.
- Antes da restauração, o arquivo é aberto e validado com `PRAGMA integrity_check`.
- Depois da validação, o estado atual recebe um backup `pre-restore-` antes de qualquer substituição.
- A restauração usa a API de backup do SQLite para preservar a conexão principal utilizada pela API.
- A interface exige confirmação explícita antes de restaurar e informa nome, data, tamanho e tipo dos arquivos.

### Contratos implementados

- `POST /backups/create`: cria backup manual.
- `GET /backups`: lista do mais recente para o mais antigo.
- `POST /backups/:name/restore`: valida, cria o ponto de segurança e restaura.
- `DELETE /backups/:name`: exclui um arquivo de backup permitido.
- A tela de Configurações cria, lista, restaura e exclui backups locais e oferece integração opcional com Google Drive.

Retenção automática, rotação e verificação periódica continuam pendentes.

## Estado Atual E Pendencias

### Base Local

Status: implementada.

- App React/Vite.
- Backend local em Node/Fastify.
- SQLite em arquivo local.
- Migrations com Drizzle.
- Scripts locais com `pnpm`.

### Nucleo Financeiro

Status: implementada em sua base principal.

- Contas/carteiras.
- Categorias.
- Lancamentos: receitas, despesas e transferencias.
- Cartoes, faturas e controle mensal.
- Parcelas.
- Relatorios iniciais: faturas, evolucao diaria, resumo anual, categorias e meios de pagamento.

### Seguranca E Dados

Status: parcial.

- Exportacao CSV implementada.
- Importacao CSV implementada.
- Backups locais do SQLite implementados com criacao, listagem, restauracao segura e exclusao; integracao opcional com Google Drive tambem esta disponivel.
- Importacao OFX pendente.
- Avaliar senha local ou criptografia do banco, se fizer sentido.

### Polimento Local

Status: em andamento.

- Melhorar UX.
- Filtros, busca e edicao em massa.
- Relatorios mensais.
- Conciliacao simples implementada para CSV.

### Empacotamento Com Electron

Status: pendente.

- Reaproveitar build Vite.
- Embutir backend/API ou migrar para comunicacao IPC.
- Definir local padrao do banco SQLite.
- Gerar app desktop instalavel.

## Decisoes Em Aberto

- Padrao de autenticacao local, caso exista.
- Estrategia de leitura OFX.
- Implementacao de reservas/caixinhas sobre as tabelas existentes.

## Transferencias

Transferencias entre contas sao modeladas como pares de lancamentos (`transactions`) vinculados por `linkedTransactionId`. Nao existe tabela propria de transferencias no schema atual.

## Módulo Compartilhado de Frontend (`apps/web/src/app/shared/`)

O frontend mantem helpers e componentes reutilizaveis em `apps/web/src/app/shared/`.

Arquivos atuais:

- `shared/csv-utils.ts` — `parseCsvHeaderLine`, `detectCsvDelimiter`, `countDelimiterOutsideQuotes`
- `shared/transaction-ui.tsx` — `buildCategoryGroups`, `renderCategoryOption`, `renderStatusBadge`, `getAmountColor`, `getResponseError`, `getMonthOptions`
- `shared/CategorySelect.tsx` — seletor unificado de categorias/subcategorias.
- `shared/MonthSelector.tsx` — navegacao e selecao de mes.
- `shared/BusinessDateInput.tsx` — input de data de negocio.
- `shared/QuickEditFields.tsx` — campos compactos de edicao rapida.

Regra: qualquer nova funcionalidade de UI que se repita entre páginas de lançamentos deve ir para este módulo.
