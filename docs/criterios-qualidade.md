# Criterios De Qualidade

Este documento define como vamos avaliar se o codigo do projeto esta bom, especialmente quando for gerado ou alterado com ajuda de IA.

## Principio Central

Codigo bom nao e apenas codigo que funciona uma vez.

Para este projeto, codigo bom precisa ser:

- Correto nas regras financeiras.
- Simples de explicar.
- Facil de testar.
- Facil de modificar depois.
- Coerente com as decisoes registradas em `docs/`.
- Seguro para os dados locais da usuaria.

## Regras Para Codigo Gerado Por IA

### 1. Regra Do Loop Fechado

Codigo gerado por IA so deve ser considerado aceito depois de verificacao automatizada.

Verificacoes esperadas conforme a etapa do projeto:

- Typecheck.
- Lint.
- Testes.
- Build.
- Execucao local do fluxo alterado.

O agente deve conseguir rodar as verificacoes e corrigir os erros antes de encerrar a tarefa.

### 2. Regra Do Dominio Critico

Qualquer codigo que toque regras financeiras centrais exige cuidado extra e testes.

Areas criticas:

- Faturas.
- Parcelamentos.
- Transferencias.
- Controle mensal.
- Orcamentos.
- Categorias e historico.
- Reservas.
- Backups.
- Importacao CSV/OFX.

Essas areas nao devem depender apenas de revisao visual ou teste manual casual.

### 3. Regra Da Explicacao

Se a solucao nao pode ser explicada em linguagem simples, ela ainda nao esta boa.

Antes de aceitar uma mudanca relevante, devemos conseguir responder:

- Qual problema esta resolvendo?
- Onde fica a regra de negocio?
- Quais dados entram?
- Quais dados saem?
- Quais casos de borda foram considerados?
- Como isso sera testado?

### 4. Regra Do Dado Financeiro

Nenhuma mudanca deve colocar dados financeiros em risco.

O codigo nao deve:

- Apagar dados usados sem confirmacao explicita.
- Apagar categorias em uso em vez de arquivar.
- Duplicar despesas ao pagar fatura.
- Contar transferencias como gasto.
- Perder historico ao renomear categoria.
- Converter valores monetarios de forma imprecisa.
- Executar migracao destrutiva sem plano claro.
- Importar dados sem etapa de revisao.
- Sobrescrever banco local sem backup.

### 5. Regra Dos Commits Pequenos

Mudancas devem ser pequenas o suficiente para revisao real.

Bom:

```text
feat(api): add accounts CRUD
feat(db): add category tables
test(domain): cover credit card bill month logic
```

Ruim:

```text
feat: add app
feat: implement all finance modules
```

Se o diff ficar grande demais para revisar com atencao, a tarefa deve ser quebrada.

### 6. Regra Das 1000 Linhas

Se uma sessao de IA gerar ou alterar mais de 1000 linhas de codigo, a revisao deve ser obrigatoriamente mais rigorosa.

Opcoes:

- Quebrar em commits menores.
- Revisar arquivo por arquivo.
- Exigir testes adicionais.
- Pedir resumo de arquitetura e riscos.

Documentacao e arquivos gerados mecanicamente podem ser tratados separadamente, desde que isso fique claro.

### 7. Regra Dos 6 Meses

O codigo deve ser compreensivel para alguem voltando ao projeto depois de meses.

Sinais bons:

- Nomes claros.
- Funcoes pequenas o suficiente para entender.
- Regras financeiras em services/domain, nao espalhadas na UI.
- Comentarios curtos onde houver regra nao obvia.
- Testes que descrevem comportamento.

Sinais ruins:

- Helpers genericos demais.
- Arquivos enormes.
- Estado espalhado.
- Abstracoes sem uso claro.
- Codigo que so da para entender seguindo muitas chamadas indiretas.

## Criterios De Arquitetura

As responsabilidades devem ficar separadas.

```text
UI: apresentacao e interacao
API route: HTTP, validacao e contrato
Service/domain: regra financeira
Database/repository: persistencia
Shared: tipos e helpers comuns
```

Regras financeiras importantes nao devem morar apenas em componentes React.

## Criterios De Teste

Prioridade maxima de teste:

- Compra no cartao impacta o mes de vencimento da fatura.
- Pagamento de fatura nao duplica despesa.
- Transferencia nao entra como gasto.
- Renomear categoria preserva historico por ID.
- Fusao de categorias move lancamentos corretamente.
- Orcamento calcula comprometido, realizado e disponivel corretamente.
- Reservas calculam aporte, resgate, rendimento e saldo corretamente.
- Backup nao sobrescreve dados sem confirmacao.

## Criterios De UI

UI boa para este projeto deve:

- Facilitar leitura mensal.
- Explicar os relatorios.
- Mostrar estados vazios.
- Mostrar carregamento e erro.
- Evitar excesso de cores.
- Usar Mantine de forma consistente.
- Manter graficos visualmente compativeis com o tema.
- Nao esconder informacao financeira importante atras de interacoes obscuras.

## Criterios De Aceite Por Tarefa

Uma tarefa so deve ser considerada pronta quando:

- A implementacao respeita as docs do projeto.
- O escopo foi mantido pequeno.
- As verificacoes relevantes foram rodadas.
- Os riscos conhecidos foram mencionados.
- O TODO foi atualizado quando aplicavel.
- O commit tem mensagem clara.

## Fontes E Inspiracoes

Estas regras foram inspiradas por discussoes recentes sobre desenvolvimento com IA, incluindo:

- A ideia de "fechar o loop": agentes devem conseguir compilar, testar, executar e validar o proprio trabalho.
- Regras praticas para codigo gerado por IA, como revisao obrigatoria para grandes diffs, caminho critico, explicabilidade e manutencao futura.

Adaptacao para este projeto:

- O risco principal nao e apenas codigo feio; e distorcer ou perder dados financeiros.
