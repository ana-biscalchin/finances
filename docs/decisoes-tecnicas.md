# Decisoes Tecnicas

Este documento registra as decisoes tecnicas do projeto e deve servir como base para as proximas discussoes de arquitetura, produto e implementacao.

## Objetivo Do Projeto

Criar um app local para gerenciamento de financas pessoais, com banco de dados simples, boa experiencia de uso e possibilidade futura de empacotamento como aplicativo desktop.

## Decisoes Ja Tomadas

### Modelo Inicial Do App

O projeto comeca como um web app local, rodando em `localhost`.

Essa escolha reduz complexidade inicial, facilita validacao do produto e permite evoluir a arquitetura antes de empacotar tudo como desktop.

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

Bibliotecas complementares planejadas:

- TanStack Table para tabelas densas.
- Recharts para graficos.
- Tabler Icons ou Lucide para icones.

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

## Plano De Progresso

### Fase 1: Web App Local

- Criar app React/Vite.
- Criar backend local em Node/Fastify.
- Usar SQLite em arquivo local.
- Definir migrations com Drizzle.
- Rodar tudo via scripts locais.

### Fase 2: Nucleo Financeiro

- Contas/carteiras.
- Categorias.
- Lancamentos: receitas, despesas e transferencias.
- Cartoes, faturas e controle mensal.
- Controle simples de investimentos por objetivos.
- Parcelas e recorrencias.
- Dashboard simples: saldo, fluxo mensal e gastos por categoria.

### Fase 3: Seguranca E Dados

- Backups automaticos do SQLite.
- Exportacao CSV.
- Importacao CSV e OFX.
- Avaliar senha local ou criptografia do banco, se fizer sentido.

### Fase 4: Polimento Local

- Melhorar UX.
- Filtros, busca e edicao em massa.
- Relatorios mensais.
- Conciliacao simples.

### Fase 5: Empacotamento Com Electron

- Reaproveitar build Vite.
- Embutir backend/API ou migrar para comunicacao IPC.
- Definir local padrao do banco SQLite.
- Gerar app desktop instalavel.

## Decisoes Em Aberto

- Estrutura de pastas do monorepo/local app.
- Gerenciador de pacotes.
- Estrategia exata de backups.
- Modelo inicial de entidades financeiras.
- Padrao de autenticacao local, caso exista.
- Layouts de CSV suportados.
- Estrategia de leitura OFX.
