# Carteira Da Ana — Memoria Do Projeto Para Agentes

Este arquivo resume o contexto do projeto para futuras sessoes de Codex/agentes.

## Identidade Do Projeto

- Nome do repo remoto: `ana-biscalchin/finances`.
- Produto: `Carteira da Ana`, projeto pessoal da Ana.
- Caminho local atual: `/home/ana/Documents/pessoal/finances`.
- Objetivo: gerenciar financas pessoais.
- Status atual: prototipo local em desenvolvimento com nucleos de contas, categorias, lancamentos, faturas, controle mensal, importacao CSV, relatorios e backups implementados.
- Distribuicao atual: prototipo web local em desenvolvimento.
- Distribuicao decidida: aplicacao web hospedada e acessada online; nao haverá executável.

## Stack Decidida

- Frontend: React + TypeScript + Vite.
- UI: Mantine.
- Backend/API: Node.js + Fastify; local no desenvolvimento e hospedado em producao.
- Banco atual: SQLite local. Banco decidido para producao: Neon PostgreSQL, inicialmente no plano gratuito.
- ORM/migrations: Drizzle.
- Gerenciador de pacotes: pnpm (workspaces).
- Graficos: Recharts.
- Icones: Tabler Icons.
- Empacotamento desktop: fora de escopo por decisao de produto.

## Principios Importantes

- Manter `localhost` apenas para desenvolvimento e testes.
- Preparar a aplicacao para hospedagem online segura, sem Electron ou executavel.
- Nao publicar o prototipo antes de implementar autenticacao, autorizacao, persistencia hospedada, gestao de segredos e backups externos.
- Controle mensal e a tela central do app.
- O Controle mensal ainda nao esta satisfatorio; avaliar seus problemas antes de redesenha-lo.
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
- `.specs/codebase/STACK.md`: stack, versoes, comandos e observacoes do ambiente.
- `.specs/codebase/ARCHITECTURE.md`: componentes, integracoes e fluxos criticos.
- `.specs/codebase/decisions/001-distribuicao-online.md`: decisao de distribuicao exclusivamente online.
- `.specs/codebase/decisions/002-arquitetura-release-online-inicial.md`: acesso, autenticacao, Render, Neon e escopo do primeiro release.
- `.specs/project/ONLINE-MIGRATION.md`: levantamento e plano de refatoracao para producao online.
- `.specs/features/online-distribution/design.md`: design tecnico proposto para a distribuicao online.
- `.specs/features/online-distribution/tasks.md`: tarefas de implementacao e gates para a distribuicao online.
- `docs/regras-negocio.md`: regras de negocio atuais.
- `docs/regras-negocio.md`: regras financeiras, inclusive cartao e fatura.
- `docs/categorias.md`: taxonomia inicial de categorias.

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
- Estrategia de leitura OFX.
- API/UI de reservas.
- Politica final de backup/retencao dentro dos limites do Neon Free.
- Momento futuro para adotar dominio proprio, OAuth Google e multiusuario.

## Como Trabalhar Neste Repo

- Antes de implementar regra financeira, consultar `docs/regras-negocio.md`.
- Consultar `.specs/codebase/STACK.md` e `.specs/codebase/ARCHITECTURE.md` antes de mudancas estruturais.
- Registrar regras financeiras em `docs/regras-negocio.md` e decisoes estruturais em `.specs/codebase/`.
- Usar `.specs/project/ROADMAP.md` para planejamento futuro quando ele for preenchido.
- Preferir commits pequenos por etapa funcional.
- Nao apagar historico ou conteudo sem confirmacao explicita.
- Nao commitar banco SQLite local, backups, `.env` ou artefatos de build.

## Varredura De Reaproveitamento

Antes de comecar a implementar uma feature nova, o agente deve:

1. Varrer os arquivos relacionados ao modulo em desenvolvimento (e modulos vizinhos) em busca de:
   - Tipos, interfaces e constantes que ja existem e podem ser reutilizados.
   - Funcoes helper, utilitarios e logica de formatacao que ja foram escritas.
   - Componentes de UI que resolvem o mesmo tipo de problema (selects, badges, tabelas, modais).
   - Padroes de estado, efeitos e handlers que se repetem entre paginas.
2. Apontar as duplicacoes encontradas antes de escrever codigo novo.
3. Quando a duplicacao for significativa (mais de ~20 linhas ou mais de 2 ocorrencias), propor extrair para um modulo compartilhado antes ou durante a implementacao.
4. Codigo compartilhado do frontend fica em `apps/web/src/app/shared/`.
5. Logica de dominio reutilizavel (regras financeiras, validacoes) fica em `packages/domain/`.

## Encerramento De Tarefas

Ao terminar uma etapa de desenvolvimento, sempre responder com:

- Features que precisam ser testadas visualmente.
- O que o app ja e capaz de fazer.
- Quais testes unitarios foram implementados/executados.

Quando houver app visual para revisar, deixar `pnpm dev` rodando em segundo plano para a usuaria abrir o app.
