# ROADMAP.md

> Stub guiado gerado pelo bootstrap. O roadmap exige julgamento humano e não foi inferido do `TODO.md` excluído.
>
> **Status:** prioridades iniciais confirmadas em 2026-07-13 por meio do fluxo `ana-sdd`.

## Agora

### Preparar a distribuição online

Decisão registrada em [ADR 001 — Distribuição exclusivamente online](../codebase/decisions/001-distribuicao-online.md). Levantamento e estimativas em [Plano de migração para distribuição online](ONLINE-MIGRATION.md). A solução proposta e sua execução estão descritas em [Design](../features/online-distribution/design.md) e [Tasks](../features/online-distribution/tasks.md).

Antes de publicar:

1. Validar Render Free + Neon Free em uma prova com HTTPS, persistência, logs e backups.
2. Implementar autenticação própria por usuário/senha e sessão segura.
3. Implementar autorização e propriedade dos dados, mantendo acesso apenas para Ana.
4. Migrar e reconciliar os dados do SQLite no PostgreSQL.
5. Retirar Google Drive do release online.
6. Implantar segurança, observabilidade, CI/CD e recuperação testada.

### Fundação mensal da Carteira da Ana

Spec ativa: [Fundação mensal da Carteira da Ana](../features/monthly-foundation/spec.md).

Ordem confirmada:

1. Simplificar o Controle mensal para planejado, gasto e disponível, indicando quando estiver acima do planejado.
2. Separar `Visão do mês` de `Dinheiro nas contas`.
3. Robustecer transferências e faturas, incluindo pagamento parcial e mínimo.
4. Implementar recorrências em conta e cartão, distintas de parcelamentos.
5. Simplificar a importação para prévia, conferência e confirmação.
6. Reforçar validações e invariantes financeiras.

## Próximo

- Adotar o nome `Carteira da Ana` na interface.
- Organizar a navegação em `Visão do mês`, `Dinheiro nas contas` e `Patrimônio`.
- Definir data-base do saldo inicial.
- Melhorar relatórios com comparações e orientação para decisão.

## Depois / backlog

- Investimentos e rentabilidade.
- Dívidas e financiamentos fora do cartão.
- Reservas e metas.
- Evolução patrimonial completa.
- IA para classificação, normalização e duplicidade na importação.
- Relatórios comparativos e orientados a decisão mais avançados.
- Backups automáticos, retenção e proteção fora do dispositivo.
- Importação OFX.
- Navegação por URLs.
- Refinamentos visuais amplos.
- Empacotamento desktop/ Electron (removido do escopo por decisão de produto).
- Login Google/OAuth.
- Cadastro e suporte multiusuário.
- Domínio próprio.
- Reintrodução opcional do Google Drive, somente se houver necessidade futura.

## Decisões pendentes

- Política final de backup/retenção após validar os recursos vigentes do Neon Free.
- Critério de migração para planos pagos se os limites gratuitos forem insuficientes.
- Paleta de cores.
- Modo claro ou escuro.
- Regras e interface do módulo de reservas.
- Regra detalhada para juros e multa de fatura.
- Estratégia de importação OFX.

## Marcos

<!-- preencher: datas ou entregas-chave, se houver. -->
