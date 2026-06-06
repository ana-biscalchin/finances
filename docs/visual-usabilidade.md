# Visual E Usabilidade

Este documento registra as decisoes de aparencia, componentes e experiencia de uso do app.

## Decisao De Biblioteca Visual

Biblioteca escolhida:

- Mantine

Motivos:

- Boa compatibilidade com React, TypeScript e Vite.
- Componentes prontos para formularios, filtros, modais, abas, seletores e dashboards.
- Visual moderno sem exigir criar todos os componentes do zero.
- Boa base para um app local de financas com telas densas e operacionais.

## Bibliotecas Complementares

Opcoes planejadas:

- TanStack Table para tabelas densas e interativas.
- Recharts para graficos.
- Tabler Icons ou Lucide para icones.

Essas bibliotecas nao precisam ser a mesma coisa que a lib visual principal, mas devem seguir os mesmos tokens visuais.

## Principio Visual

O app deve parecer:

- Claro.
- Organizado.
- Calmo.
- Confiavel.
- Bonito sem ser chamativo demais.
- Explicativo nos relatorios.

O objetivo nao e parecer uma planilha, nem um sistema corporativo frio. A interface deve ajudar a entender o mes, tomar decisoes e acompanhar progresso.

## Relatorios E Graficos

Relatorios devem ser bonitos e bem explicativos.

Cada relatorio deve responder uma pergunta concreta, por exemplo:

- Para onde meu dinheiro foi este mes?
- Quanto ainda posso gastar?
- O que ja esta comprometido na fatura?
- Minhas reservas estao evoluindo?
- Quais categorias estao acima do esperado?

Os graficos devem vir acompanhados de contexto textual curto, indicadores e legendas claras.

## Tipos De Visualizacao Planejados

### Controle Mensal

Visualizacao principal do app.

Deve combinar:

- Tabela agrupada.
- Barras de progresso por categoria.
- Destaques para estouro ou proximidade do limite.
- Filtros por mes, grupo, meio de pagamento e categoria.

Indicadores:

- Orcado.
- Comprometido.
- Realizado.
- Disponivel.
- Percentual usado.

### Dashboard

Deve mostrar uma leitura rapida do mes.

Blocos esperados:

- Saldo geral.
- Receitas do mes.
- Despesas do mes.
- Reservas/investimentos simples.
- Proximos vencimentos.
- Principais categorias do mes.

### Relatorio De Categorias

Deve priorizar barras horizontais para comparacao.

Evitar depender de grafico de pizza como visualizacao principal.

### Relatorio De Faturas

Deve mostrar:

- Evolucao mensal das faturas.
- Composicao da fatura por categoria.
- Parcelas futuras comprometidas.
- Status da fatura: aberta, fechada, paga.

### Relatorio De Reservas

Deve mostrar:

- Evolucao mensal do saldo por objetivo.
- Aportes.
- Resgates.
- Rendimentos.
- Progresso contra valor alvo.

## Compatibilidade Visual

Mesmo quando uma tela usar TanStack Table ou Recharts, ela deve parecer parte do mesmo app.

Para isso, devem ser compartilhados:

- Cores.
- Tipografia.
- Espacamentos.
- Bordas.
- Radius.
- Estados de hover/foco.
- Tooltips.
- Legendas.
- Cores semanticas.

## Diretrizes De Interface

- Priorizar leitura rapida.
- Usar tabelas densas quando houver muitos dados.
- Usar graficos para explicar tendencias e comparacoes, nao para decorar.
- Evitar excesso de cores.
- Usar cores semanticas com moderacao: positivo, alerta, perigo, neutro.
- Dar contexto nos relatorios antes do grafico quando isso ajudar a leitura.
- Manter filtros sempre visiveis ou facilmente acessiveis nas telas analiticas.
- Permitir alternar visoes quando o mesmo dado precisar ser entendido por categoria, meio de pagamento ou fatura.

## Decisoes Em Aberto

- Paleta de cores.
- Tipografia.
- Modo claro/escuro.
- Densidade padrao das tabelas.
- Estilo de cards e paineis.
- Biblioteca final de icones: Tabler Icons ou Lucide.
