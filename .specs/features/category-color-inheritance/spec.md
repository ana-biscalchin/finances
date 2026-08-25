# Cores herdadas de categorias

## Objetivo

Permitir que a usuária escolha a cor de uma categoria pai e manter suas subcategorias visualmente
relacionadas por tons claros derivados automaticamente da mesma família de cor.

## Requisitos

- **CAT-COLOR-01:** QUANDO uma categoria for criada ou editada ENTÃO o sistema DEVE permitir
  selecionar uma cor de uma paleta controlada.
- **CAT-COLOR-02:** QUANDO a cor da categoria pai mudar ENTÃO todas as suas subcategorias DEVEM
  refletir a nova família de cor sem edição individual.
- **CAT-COLOR-03:** QUANDO subcategorias forem exibidas ENTÃO o sistema DEVE derivar tons claros
  pela ordem delas, sem persistir uma cor própria em cada subcategoria.
- **CAT-COLOR-04:** QUANDO os dados existentes forem migrados ENTÃO as cores atualmente associadas
  às categorias semeadas DEVEM ser preservadas.
- **CAT-COLOR-05:** QUANDO a API receber uma cor fora da paleta suportada ENTÃO DEVE rejeitar o
  payload com erro de validação.

## Decisões confirmadas

- A cor pertence somente à categoria pai.
- Subcategorias herdam automaticamente e não oferecem seletor de cor próprio.
- A paleta é controlada para manter consistência e legibilidade.
- A mesma regra central é reutilizada em categorias, seletores e lançamentos.

## Validação visual

- Criar e editar uma categoria escolhendo cores diferentes.
- Confirmar que as subcategorias mudam imediatamente para tons claros da nova cor.
- Conferir as cores no seletor de categorias e na edição rápida de lançamentos.
