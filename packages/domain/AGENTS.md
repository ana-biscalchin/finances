# Domínio — Instruções Para Agentes

> Unidade: `packages/domain` · Hub: `../../AGENTS.md`

## Propósito

Concentrar tipos, validações e regras financeiras puras reutilizadas pela API e pelo frontend, sem dependência de React, Fastify ou SQLite.

## Arquivos principais

| Arquivo | Responsabilidade |
| --- | --- |
| `src/index.ts` | API pública do pacote |
| `src/money.ts` | Dinheiro em centavos, parsing, soma e formatação |
| `src/dates.ts` | Datas de negócio e competências mensais |
| `src/accounts.ts` | Tipos e validação de contas |
| `src/categories.ts` | Naturezas e cores de categorias |
| `src/transactions.ts` | Tipos e status de lançamentos |
| `src/financial-classification.ts` | Classificação econômica e impacto em contas |
| `src/credit-card-bills.ts` | Mês, fechamento e vencimento de faturas |
| `src/reconciliation.ts` | Pontuação e proximidade para conciliação |

## Como funciona

- Cada módulo expõe tipos e funções puras de uma área financeira.
- `src/index.ts` define o contrato público consumido pelos demais workspaces.
- Dinheiro é representado em centavos inteiros.
- Datas de negócio são strings `YYYY-MM-DD`.
- Competências são strings `YYYY-MM`.
- Tipos vindos de fronteiras devem ser validados antes do uso.
- Classificações distinguem consumo, movimento de conta, cartão, pagamento de fatura e transferência.
- Funções não devem acessar banco, rede, filesystem ou estado global.
- Toda mudança de comportamento financeiro deve ser acompanhada por teste unitário.
- Regras devem permanecer coerentes com `docs/regras-negocio.md`.

## Entry points

- API pública: `src/index.ts`
- Testes: arquivos `src/*.test.ts`
- Build: `pnpm --filter @finances/domain build`

## Extensão

Para adicionar uma regra financeira:

1. Confirme a regra nos documentos e com a usuária quando houver ambiguidade.
2. Procure tipos e helpers existentes antes de criar novos.
3. Escreva primeiro um teste que expresse o comportamento.
4. Implemente uma função pura com entradas e saídas explícitas.
5. Exporte a função em `src/index.ts` somente se houver consumidor externo.
6. Evite dependências novas para regras pequenas.
7. Atualize a documentação de negócio quando o comportamento mudar.

## Integrações

- Consumido por `apps/api`.
- Consumido por `apps/web`.
- Não depende de `packages/database`.
- Não deve depender de frameworks ou infraestrutura.

## Testes

```bash
pnpm --filter @finances/domain test
pnpm --filter @finances/domain typecheck
pnpm --filter @finances/domain lint
pnpm --filter @finances/domain build
```

Suítes observadas:

- `accounts.test.ts`
- `categories.test.ts`
- `dates.test.ts`
- `money.test.ts`
- `transactions.test.ts`
- `reconciliation.test.ts`

## Pontos de atenção

- O pacote contém regras centrais, mas parte da lógica financeira ainda está nos módulos da API.
- Extraia para este pacote somente regras puras e realmente reutilizáveis.
- Não altere sem testes as classificações usadas por saldos, Controle mensal e relatórios.
- Preserve a diferença entre consumo econômico e movimento de conta.
- Preserve o cálculo do mês da fatura e as regras de data sem conversões UTC acidentais.

## Constituição

Aplicam-se `../../AGENTS.md`, `ana-standards`, `ana-sdd` e `ana-tdd`.
