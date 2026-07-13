# Guia de Orientacao: Importacao CSV

Este documento descreve como preparar CSVs para os fluxos atuais de importacao do app e foi revisado a partir do codigo de entrada em `apps/web/src/app/transactions`, `apps/web/src/app/cards` e `apps/api/src/modules/transactions.ts`.

## Fonte Dinamica de Categorias, Contas e Meios

As instrucoes de apoio a importacao nao devem congelar listas de categorias, contas ou meios de pagamento neste Markdown.

- Categorias e subcategorias validas sao as que estiverem cadastradas no app no momento da importacao.
- Os prompts de IA exibidos nas telas de importacao sao montados dinamicamente a partir de `GET /categories`.
- As contas disponiveis vem do cadastro atual de contas.
- Os meios de pagamento vem do cadastro/semente atual de meios de pagamento; na importacao geral eles podem ser ajustados na previa, mas cartao de credito nao deve ser usado como meio operacional de caixa.
- `docs/categorias.md` documenta a taxonomia conceitual/base. Para importar, a fonte operacional e sempre a tela/API atual, porque categorias podem ser renomeadas, arquivadas ou expandidas.

Quando precisar orientar uma IA externa a converter extratos ou faturas, use o botao **Copiar prompt IA** dentro da propria tela de importacao. Esse prompt ja inclui a versao mais recente das subcategorias carregadas pelo app.

## Formato de Arquivo

- Separadores aceitos: virgula, ponto e virgula ou tabulacao. O sistema detecta o separador pela primeira linha.
- A primeira linha deve conter cabecalhos.
- Campos com separador interno devem vir entre aspas duplas. Exemplo em CSV separado por virgula: `"R$ 1.500,00"`.
- UTF-8 com BOM e aceito; o BOM e removido do primeiro cabecalho.
- Linhas vazias sao ignoradas.

## Importacao Geral de Lancamentos

Fluxo usado pela tela **Lancamentos > Importar CSV**.

### Colunas

Obrigatorias:

- Data
- Descricao
- Valor

Opcionais:

- Tipo/Natureza
- Categoria/Subcategoria

A tela tenta mapear cabecalhos automaticamente:

- Data: nomes contendo `data` ou `date`.
- Descricao: nomes contendo `desc`, `hist` ou `memo`.
- Valor: nomes contendo `valor`, `amount` ou `val`.
- Tipo: nomes contendo `tipo`, `type` ou `natureza`.
- Categoria: nomes contendo `categoria`, `category` ou `subcategoria`.

O mapeamento pode ser corrigido manualmente antes da previa.

### Datas

Escolha o formato correto na etapa de mapeamento:

- `DMY`: `DD/MM/AAAA` ou `DD-MM-AAAA`
- `MDY`: `MM/DD/AAAA` ou `MM-DD-AAAA`
- `YMD`: `AAAA-MM-DD` ou `AAAA/MM/DD`

Datas ambiguas, como `06/07/2026`, dependem dessa escolha.

### Valores e Tipos

O parser aceita moeda, virgula decimal, ponto decimal, separadores de milhar e valores entre parenteses.

Exemplos aceitos:

```csv
1500.00
-1200.00
1500,00
R$ 1.500,00
(150,00)
```

Na importacao geral:

- valor positivo vira `income` quando nao ha tipo mapeado;
- valor negativo, sinal no fim ou parenteses vira `expense`;
- se a coluna de tipo for mapeada, ela pode sobrescrever o fallback do sinal.

Tipos reconhecidos como receita: `Receita`, `Income`, `Entrada`, `Credito`, `Credit`, `CR`, `C` e textos iniciados por `(+)`.

Tipos reconhecidos como despesa: `Despesa`, `Expense`, `Saida`, `Debito`, `Debit`, `DB`, `D` e textos iniciados por `(-)`.

### Categorias

A coluna de categoria e resolvida contra as subcategorias atuais do banco.

O importador tenta, nesta ordem:

1. usar o valor como ID interno de subcategoria, se bater exatamente;
2. encontrar uma subcategoria com o mesmo nome normalizado;
3. encontrar a combinacao normalizada de categoria pai + subcategoria;
4. encontrar uma subcategoria cujo nome esteja contido no texto.

Sinais e palavras como `Receita`, `Despesa`, `Credito`, `Debito`, `Entrada` e `Saida` sao removidos antes da busca de categoria. Assim, valores como `(-) Farmacia` e `(+) Salario` podem funcionar como tipo e categoria quando a mesma coluna for mapeada nos dois campos.

Para despesa, o resolvedor considera categorias de natureza `expense` e `transfer`. Para receita, considera `income` e `transfer`.

Se nao houver correspondencia, a linha continua na previa sem categoria, e a categoria pode ser ajustada manualmente antes de confirmar.

### Conta e Meio de Pagamento

Na importacao geral, a conta pode vir de um padrao escolhido na tela. O codigo atual tambem le um campo `accountId` quando enviado para a API, mas a tela principal de importacao nao expoe uma coluna de conta no mapeamento.

O meio de pagamento nao e inferido pelo CSV neste fluxo. Ele pode ser ajustado na etapa final de previa, inclusive em lote.

### Duplicidades

Na previa da importacao geral, uma linha e marcada como possivel duplicata quando encontra lancamento existente com:

- mesmo valor;
- mesma conta, quando ambas as contas estao informadas;
- data proxima em ate 3 dias.

Duplicatas ficam desmarcadas por padrao na previa. Na confirmacao, com `preventDuplicates`, a API tambem evita criar lancamento igual considerando valor, data, descricao, competencia e conta.

## Importacao de Fatura de Cartao

Fluxo usado pela tela **Faturas > Importar fatura**.

### Regras Principais

- Todas as linhas importadas entram ligadas ao cartao da fatura aberta.
- Compras de cartao ficam sem `accountId` e sem `paymentMethodId`.
- O mes da fatura aberta e enviado como `billMonth`.
- A fatura importada e a fonte de verdade: compras do CSV entram no `billMonth` aberto, mesmo quando a data da compra cair fora do periodo teorico calculado pelo fechamento.
- A competencia (`budgetMonth`) vem da fatura, nao necessariamente do mes da data da compra nem da regra automatica de fechamento.
- Parcelas futuras podem ser criadas automaticamente.

### CSV Recomendado

```csv
Data;Descricao;Valor;Categoria;Parcela;TotalParcelas
10/06/2026;Compra Parcelada;"100,00";Roupas e calcados;2;3
12/06/2026;Supermercado;"230,45";Supermercado;;
14/06/2026;Farmacia;"58,90";Farmacia;;
```

Mapeamento esperado:

| Campo no app | Coluna do CSV |
| :--- | :--- |
| Coluna de data | `Data` |
| Coluna de descricao | `Descricao` |
| Coluna de valor | `Valor` |
| Coluna de categoria | `Categoria` |
| Parcela atual | `Parcela` |
| Total de parcelas | `TotalParcelas` |

Tambem e aceito usar uma coluna unica com `2/3` ou `2 de 3`. Nesse caso, selecione essa coluna em **Coluna de parcela (2/3)** e deixe **Parcela atual** e **Total de parcelas** vazios.

### Valores em Fatura

No fluxo de fatura:

- compras normais devem vir com valor positivo;
- estornos ou creditos na fatura devem vir negativos;
- valor positivo vira `expense`;
- valor negativo vira `chargeback`.

O valor salvo continua positivo em centavos; o tipo carrega o sentido economico.

### Parcelamento

Se a linha da fatura atual vier como `2/3`, o importador cria:

```text
Compra (2/3) -> fatura atual
Compra (3/3) -> proxima fatura
```

Ele nao cria a `1/3`, porque ela pertence a uma fatura anterior.

Se vier como `1/3`, cria:

```text
Compra (1/3) -> fatura atual
Compra (2/3) -> proxima fatura
Compra (3/3) -> fatura seguinte
```

O limite maximo aceito pelo parser e 48 parcelas.

### Duplicidades em Fatura

Na previa de fatura, o sistema procura duplicatas pelo mes da fatura, nao apenas pela janela de datas, porque parcelas futuras podem manter a data original da compra.

Uma compra de cartao e considerada duplicata quando bate:

- cartao;
- mes da fatura;
- descricao normalizada;
- valor;
- data proxima em ate 3 dias para compra avulsa.

Para parcelas, a checagem tolera diferenca de ate 2 centavos no valor e nao exige a data proxima quando a descricao/parcelamento ja bate.

Na confirmacao, `preventDuplicates` tambem evita recriar compras de cartao ja existentes no mesmo mes da fatura com mesmo cartao, descricao normalizada e valor compativel.

## Conciliador de Extrato — capacidade atual em simplificacao

O conciliador em **Lancamentos > Conciliar extrato** existe hoje como um fluxo diferente da
importacao geral. Ele nao e mais a direcao principal do produto: a spec
`.specs/features/monthly-foundation/spec.md` define sua substituicao por importacao com previa e
conferencia simples. Ate essa mudanca ser implementada, o comportamento atual e:

- O CSV e lido no cliente.
- Ele exige apenas data, descricao e valor.
- A conta ou cartao de destino e escolhido antes da analise.
- O backend busca candidatos com mesmo valor absoluto e status diferente de `canceled` e `reconciled`.
- Matches com score maior ou igual a 90 sao tratados como exatos; acima de 50 como parciais.
- Ao criar lancamento novo pelo conciliador, a subcategoria e obrigatoria.
- Lancamentos criados ou vinculados pelo conciliador ficam com status `reconciled`.

## Exemplos

Importacao geral:

```csv
Data;Descricao;Valor;Tipo;Categoria
12/06/2026;Aluguel de Junho;"-1200,00";Despesa;Aluguel
13/06/2026;Reembolso Viagem;"350,50";Receita;Reembolso
14/06/2026;Supermercado;"-230,50";Despesa;Supermercado
15/06/2026;Salario do Mes;"4500,00";Receita;Salario
```

Fatura de cartao:

```csv
Data;Descricao;Valor;Categoria;Parcela;TotalParcelas
10/06/2026;Compra Parcelada;"100,00";Roupas e calcados;2;3
12/06/2026;Supermercado;"230,45";Supermercado;;
14/06/2026;Credito de contestacao;"-58,90";Estorno;;
```
