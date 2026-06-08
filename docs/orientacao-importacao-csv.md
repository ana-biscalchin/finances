# Guia de Orientação: Importação de Lançamentos via CSV

Este documento orienta sobre como estruturar arquivos CSV para importar lançamentos financeiros no aplicativo de finanças pessoais de forma correta e sem duplicidades.

---

## 1. Estrutura e Formato do Arquivo CSV

O arquivo deve ser um arquivo de texto comum no formato **CSV (Comma-Separated Values)**. 

### Requisitos Técnicos:
- **Separador**: O sistema detecta automaticamente vírgula (`,`), ponto e vírgula (`;`) ou tabulação como separador de campos.
- **Aspas**: Campos que contenham o próprio separador internamente devem estar entre aspas duplas (ex: `"R$ 1.500,00"` em CSV separado por vírgula).
- **Cabeçalho**: A primeira linha do arquivo deve conter os nomes das colunas (ex: `Data,Descrição,Valor` ou `Data;Descrição;Valor`).
- **Codificação**: Arquivos UTF-8 com BOM são aceitos; o BOM é ignorado no primeiro cabeçalho.

---

## 2. Colunas e Mapeamento Dinâmico

O sistema de importação possui mapeamento flexível. Você não precisa alterar o nome das colunas do seu arquivo ou planilha; basta associá-las na tela do assistente de importação.

### Colunas Obrigatórias:
1. **Data**: O dia em que a transação ocorreu.
2. **Descrição**: O texto descritivo do lançamento (ex: "Supermercado Z", "Salário Mensal").
3. **Valor**: O valor monetário da transação.

### Coluna Opcional:
- **Tipo/Natureza**: Indica se é uma **Receita** (entrada) ou **Despesa** (saída). Se esta coluna não for mapeada, o sistema decidirá o tipo automaticamente com base no sinal do valor (valores negativos ou normais).
- **Categoria**: Indica a categoria/subcategoria do lançamento. Pode conter nomes diretos como `Farmácia`, `Delivery` e `Saldo anterior`, ou textos com sinal como `(-) Farmácia` e `(+) Saldo anterior`.

> A mesma coluna pode ser usada para **Tipo/Natureza** e **Categoria** quando ela combina sinal e categoria, como no formato `(-) Farmácia`.

---

## 3. Formatação dos Dados

Para garantir que a importação ocorra com sucesso, siga as regras de formatação abaixo:

### Formato de Data (Data):
O sistema aceita os formatos mais comuns de data:
- **Padrão ISO**: `AAAA-MM-DD` (ex: `2026-06-07`)
- **Padrão Brasileiro**: `DD/MM/AAAA` (ex: `07/06/2026`) ou `DD-MM-AAAA` (ex: `07-06-2026`)
- **Padrão Americano**: `MM/DD/AAAA` (ex: `06/07/2026`) ou `MM-DD-AAAA` (ex: `06-07-2026`)

Na etapa de mapeamento, escolha o **Formato da Data** correspondente ao arquivo importado. Isso é especialmente importante em datas ambíguas como `06/07/2026`, que pode significar 6 de julho ou 7 de junho dependendo do formato.

### Formato de Valor (Valor):
O parser monetário é inteligente e aceita números inteiros, decimais em formato americano ou brasileiro, com ou sem símbolos de moeda:
- **Formatos Válidos**:
  - `1500.00` ou `-1200.00`
  - `1500,00` ou `-1200,00`
  - `R$ 1.500,00` ou `R$ -1.200,00`
  - `(150,00)` (valores entre parênteses são auto-detectados como despesas/valores negativos)

### Formato de Tipo/Natureza:
Quando a coluna de tipo/natureza for mapeada, o sistema reconhece:
- Indicadores positivos como `Receita`, `Entrada`, `Crédito`, `C` e textos iniciados por `(+)`.
- Indicadores negativos como `Despesa`, `Saída`, `Débito`, `D` e textos iniciados por `(-)`.

Exemplos aceitos: `(+) Saldo anterior`, `(+) Salário`, `(-) Farmácia`, `(-) Supermercado`.

---

## 4. Detecção de Duplicidades e Reconciliação

Para evitar que você importe lançamentos repetidos, o sistema realiza uma varredura automática nos lançamentos existentes no banco de dados e sinaliza possíveis duplicatas se encontrar:
- O **mesmo valor** (em centavos);
- A **mesma conta** de origem (se aplicável);
- Uma **data próxima** (intervalo de até **3 dias** para mais ou para menos).

> [!IMPORTANT]
> Na tela de **Reconciliação (Passo 3)**, os itens identificados como duplicados são **desmarcados por padrão** para proteger seu saldo contra duplicações acidentais. Se desejar importá-los mesmo assim, você poderá marcá-los manualmente na lista.

---

## 5. Meios de Pagamento Aceitos

Ao fazer a importação, as transações serão associadas aos meios de pagamento disponíveis. Os meios de pagamento cadastrados no sistema são:

| Meio de Pagamento | Identificador Interno | Descrição/Tipo |
| :--- | :--- | :--- |
| **Pix** | `pm-pix` | Transferência instantânea |
| **Dinheiro** | `pm-cash` | Dinheiro em espécie |
| **Cartão de débito** | `pm-debit-card` | Débito em conta corrente |
| **Cartão de crédito** | `pm-credit-card` | Lançamento em fatura |
| **Cartão pré-pago** | `pm-prepaid-card` | Saldo recarregável |
| **Boleto** | `pm-bank-slip` | Pagamento de fichas de compensação |
| **Débito automático** | `pm-auto-debit` | Cobrança automática em conta |
| **Transferência bancária/TED** | `pm-bank-transfer` | Transferências tradicionais |

---

## 6. Categorias e Subcategorias Aceitas

Na terceira etapa da importação, você poderá atribuir categorias a cada lançamento individualmente antes de salvá-los no banco. A taxonomia do sistema é estruturada da seguinte forma:

### 📥 Receitas (Entradas)
- **Trabalho**: `Salário` (Fixo), `Bônus` (Variável), `Hora extra` (Variável), `13º salário` (Extra).
- **Rendimentos e Resgates**: `Resgate de investimento` (Extra), `Dividendos e Juros` (Variável).
- **Outras Receitas**: `Flash alimentação` (Fixo), `Flash convênio` (Fixo), `Reembolso` (Extra), `Estorno` (Extra), `Cashback` (Variável), `Saldo anterior` (Extra).

### 🔄 Movimentações Neutras (Transferências)
- **Movimentações Internas**: `Entre minhas contas` (Variável), `Pagamento de fatura` (Fixo).

### 📤 Despesas (Saídas)
- **Moradia & Casa**: `Aluguel` (Fixo), `Condomínio` (Fixo), `Luz` (Fixo), `Gás` (Fixo), `Internet e celular` (Fixo), `Compras para casa` (Variável), `Material de limpeza` (Variável), `Manutenção e reformas` (Extra).
- **Alimentação**: `Supermercado` (Variável), `Feira e hortifruti` (Variável), `Restaurantes` (Variável), `Delivery` (Variável), `Cafeteria e lanches` (Variável), `Bares e festas` (Variável).
- **Transporte**: `Metrô e ônibus` (Variável), `Uber e táxi` (Variável), `Combustível e estacionamento` (Variável).
- **Saúde e Bem-estar**: `Academia` (Fixo), `Personal` (Fixo), `Terapia` (Fixo), `Nutricionista` (Fixo), `Farmácia` (Variável), `Cosméticos` (Variável), `Estética` (Variável), `Médico e dentista` (Extra), `Hospital e exames` (Extra).
- **Lazer e Estilo de Vida**: `Viagens` (Variável), `Cinema, teatro e shows` (Variável), `Livros e cultura` (Variável), `Assinaturas de streaming` (Fixo), `Roupas e calçados` (Variável), `Presentes` (Variável), `Outros passeios` (Variável).
- **Educação e Desenvolvimento**: `Faculdade` (Fixo), `Cursos` (Variável).
- **Gastos Shuri**: `Ração` (Variável), `Petiscos` (Variável), `Higiene` (Variável), `Brinquedos` (Variável), `Saúde e veterinário` (Variável).
- **Impostos e Serviços Financeiros**: `Contabilidade` (Fixo), `Impostos (IRPF)` (Fixo), `Empréstimos Caixa` (Fixo), `Seguro Nu` (Fixo), `Apoio Uel` (Fixo), `Doação` (Variável), `Tarifas e juros` (Variável), `Anuidade cartão` (Fixo).
- **Investimentos (Aportes)**: `Aporte em corretora` (Variável), `Reserva de emergência` (Fixo), `Poupança da Shuri` (Fixo), `Poupança da casa` (Fixo).

---

## 7. Exemplo de Arquivo CSV Correto

Abaixo está um exemplo de conteúdo estruturado que é processado e aceito com sucesso pelo aplicativo:

```csv
Data,Descrição,Valor,Tipo
12/06/2026,Aluguel de Junho,-1200.00,Despesa
13/06/2026,Reembolso Viagem,350.50,Receita
14/06/2026,Supermercado,R$ 230,50,Despesa
15/06/2026,Salário do Mês,"R$ 4.500,00",Receita
```

Também é aceito CSV separado por ponto e vírgula, comum em planilhas exportadas em português:

```csv
Data;Lançamento;Valor;Tipo;Forma de Pagamento
06/01/2026;saldo em conta;R$ 1.224,58;(+) Saldo anterior;Pix/Débito Nubank
06/02/2026;farmacia antiinflamatorio;R$ 55,89;(-) Farmácia;Pix/Débito Nubank
```

Para arquivos nesse formato, se as datas estiverem no padrão americano, selecione **MM/DD/AAAA** no campo **Formato da Data** durante o mapeamento.
