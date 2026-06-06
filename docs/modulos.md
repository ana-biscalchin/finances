# Modulos Do Projeto

Este documento registra os modulos funcionais planejados para o app de financas pessoais.

## Principios De Dominio

Alguns conceitos devem ficar separados desde o inicio:

- Conta: onde o dinheiro esta ou passa.
- Meio de pagamento: como o pagamento foi feito.
- Lancamento: evento financeiro de receita, despesa ou ajuste.
- Transferencia: movimento entre contas, sem impacto como gasto.
- Fatura: agrupamento de despesas de cartao por mes de vencimento.
- Data da compra: quando o gasto aconteceu.
- Data de impacto no orcamento: mes em que o gasto entra no controle mensal.

Para cartao de credito, a despesa deve impactar o mes de vencimento da fatura, nao necessariamente o mes da compra.

## Modulos Essenciais

### Contas

Gerencia os locais onde existe saldo ou movimentacao financeira.

Exemplos:

- Conta corrente.
- Poupanca.
- Carteira/dinheiro.
- Conta de investimento.
- Vale alimentacao/refeicao.
- Carteira digital.

Campos esperados:

- Nome.
- Tipo.
- Instituicao.
- Saldo inicial.
- Status ativa/inativa.

Regras esperadas:

- Contas podem ser renomeadas e ter tipo/instituicao alterados.
- Arquivar conta apenas remove das listas padrao; nao apaga historico.
- Contas arquivadas podem ser restauradas.
- Exclusao definitiva deve ser acao separada, com confirmacao e validacoes.

### Meios De Pagamento

Lista fixa das formas usadas para pagar ou receber. Nao precisa de CRUD no app.

Lista base confirmada:

- Pix.
- Dinheiro.
- Cartao de debito.
- Cartao de credito.
- Cartao pre-pago.
- Boleto.

Sugestoes para validar:

- Debito automatico.
- Transferencia bancaria/TED.
- Carteira digital.
- Vale alimentacao.
- Vale refeicao.
- Cheque.
- Financiamento/crediario.
- Outro.

O meio de pagamento deve ser uma dimensao central no controle mensal, mas sua lista deve ser mantida como seed/configuracao interna versionada.

### Categorias

Organiza receitas e despesas.

Deve permitir criar, editar, arquivar e gerenciar a estrutura de classificacao financeira.

A estrutura gerenciavel deve incluir:

- Natureza: receita, despesa, investimento/reserva ou transferencia.
- Grupo: fixa, variavel, extra, entrada, objetivo/caixinha etc.
- Macro tipo.
- Micro tipo.

Exemplos:

- Alimentacao > Mercado.
- Alimentacao > Restaurante.
- Casa > Aluguel.
- Casa > Luz.
- Transporte > Combustivel.

Regras esperadas:

- Macros e micros devem ser editaveis pela usuaria.
- A lista inicial deve vir com sugestoes baseadas na taxonomia do projeto.
- Categorias ja usadas em lancamentos nao devem ser apagadas fisicamente; devem ser arquivadas/inativadas.
- Deve ser possivel renomear grupos, macros e micros sem perder historico.
- O historico deve se vincular por ID interno, nao pelo nome textual da categoria.
- Deve ser possivel reordenar grupos, macros e micros.
- Deve haver fluxo de fusao de categorias para corrigir duplicidades.
- Deve haver aviso antes de arquivar categorias em uso.
- Categorias arquivadas nao devem aparecer como padrao em novos lancamentos, mas devem continuar visiveis em historico e relatorios antigos.
- O app deve evitar micro tipos duplicados dentro do mesmo macro tipo.

### Lancamentos

Registra receitas, despesas e ajustes.

Campos esperados:

- Tipo: receita, despesa ou ajuste.
- Descricao.
- Valor.
- Data do evento.
- Data de impacto no orcamento.
- Conta.
- Meio de pagamento.
- Categoria.
- Status: previsto, confirmado, conciliado, cancelado.
- Observacao.

### Transferencias

Registra movimentos entre contas.

Transferencias nao devem entrar como despesa no orcamento.

Exemplos:

- Conta corrente para carteira.
- Conta corrente para investimento.
- Pagamento de fatura de cartao.
- Resgate de investimento para conta corrente.

Campos esperados:

- Conta origem.
- Conta destino.
- Valor.
- Data.
- Meio.
- Status.
- Observacao.

Tarifas, IOF e taxas relacionadas devem ser lancamentos de despesa separados.

### Cartoes De Credito

Gerencia cartoes e suas regras de fatura.

Campos esperados:

- Nome do cartao.
- Instituicao.
- Dia de fechamento.
- Dia de vencimento.
- Conta padrao para pagamento.
- Limite opcional.
- Status ativo/inativo.

### Faturas

Agrupa as compras do cartao por mes de vencimento.

Campos esperados:

- Cartao.
- Mes de referencia/vencimento.
- Data de fechamento.
- Data de vencimento.
- Status: aberta, fechada, paga.
- Valor calculado pelas compras vinculadas.

O pagamento da fatura deve quitar a fatura, mas nao criar nova despesa duplicada.

### Parcelamentos

Controla compras parceladas.

Uma compra parcelada deve gerar parcelas futuras vinculadas as faturas corretas.

Campos esperados:

- Compra original.
- Quantidade de parcelas.
- Numero da parcela.
- Valor da parcela.
- Fatura vinculada.

## Modulo Central

### Controle Mensal

Tela principal para acompanhar o orcamento do mes.

Deve agrupar os dados por:

```text
Mes
└─ Meio de pagamento
   └─ Tipo
      └─ Categoria
```

Indicadores por linha:

- Orcado.
- Comprometido.
- Realizado.
- Disponivel.
- Percentual usado.

Definicoes:

- Orcado: limite planejado para o mes.
- Comprometido: valor ja previsto ou reservado, mas ainda nao necessariamente pago.
- Realizado: valor confirmado/pago.
- Disponivel: orcado menos o valor consumido ou comprometido, conforme a visualizacao escolhida.

Essa tela deve responder rapidamente:

- Quanto ainda posso gastar este mes?
- Em qual categoria estou perto de estourar?
- Quanto do cartao ja esta comprometido para a fatura atual?
- Quanto ja saiu por Pix, debito, dinheiro ou boleto?

## Modulos De Planejamento

### Orcamentos

Define limites mensais.

Deve permitir orcamento por:

- Categoria.
- Meio de pagamento.
- Tipo de gasto.
- Mes.

Pode evoluir para orcamentos recorrentes, usados como base para criar novos meses.

### Recorrencias

Controla lancamentos repetidos.

Exemplos:

- Salario.
- Aluguel.
- Assinaturas.
- Internet.
- Energia.
- Condominio.

Deve gerar lancamentos previstos.

### Investimentos Simples

Controle simples de valores guardados por objetivo, no estilo caixinhas.

O foco nao e fazer acompanhamento sofisticado de mercado, corretora ou cotacao. O foco e saber quanto foi guardado, retirado e quanto rendeu por objetivo.

Exemplos de objetivos:

- Reserva de emergencia.
- Viagem.
- Entrada de imovel.
- Reforma.
- Impostos.

Campos esperados para cada objetivo:

- Nome.
- Valor alvo opcional.
- Conta vinculada opcional.
- Data alvo opcional.
- Status ativo/concluido/arquivado.

Movimentacoes esperadas:

- Aporte.
- Resgate.
- Rendimento.
- Ajuste.

Indicadores:

- Total aportado.
- Total resgatado.
- Rendimento acumulado.
- Saldo atual.
- Progresso contra valor alvo.
- Evolucao mensal do saldo.

Transferencias entre conta corrente e investimento devem ser registradas como transferencias. A movimentacao do objetivo registra a finalidade do dinheiro dentro do modulo de investimentos.

### Metas

Metas podem ser cobertas inicialmente pelo modulo de investimentos simples.

Se no futuro houver metas que nao sejam dinheiro guardado, o modulo pode ser separado.

## Modulos De Apoio

### Relatorios

Relatorios planejados:

- Gastos por categoria.
- Receitas versus despesas.
- Fluxo mensal.
- Evolucao de saldo.
- Evolucao de investimentos simples.
- Faturas por periodo.
- Comparativo entre meses.

### Importacao E Exportacao

Formatos suportados:

- CSV.
- OFX.

Nao ha necessidade de importacao/exportacao JSON no escopo atual.

CSV deve ser usado para importacao/exportacao simples e portabilidade.

OFX deve ser considerado para importacao de extratos bancarios e cartoes quando o formato estiver disponivel.

### Backups

Responsavel por proteger o banco SQLite local.

Funcionalidades esperadas:

- Backup manual.
- Backup automatico.
- Restauracao.
- Retencao dos ultimos backups.

### Configuracoes

Centraliza preferencias e cadastros auxiliares.

Exemplos:

- Moeda.
- Formato de data.
- Meios de pagamento.
- Preferencias de backup.
- Futuramente senha local ou criptografia.

## MVP Proposto

Primeiro ciclo:

- Contas.
- Meios de pagamento.
- Categorias.
- Lancamentos.
- Transferencias.
- Cartoes de credito.
- Faturas.
- Parcelamentos.
- Controle mensal.
- Investimentos simples.
- Backup basico.

Segundo ciclo:

- Recorrencias.
- Orcamentos mais avancados.
- Relatorios completos.
- Importacao CSV.
- Importacao OFX.
- Polimento de investimentos.
