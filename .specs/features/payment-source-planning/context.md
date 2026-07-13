# Contexto — Planejamento por conta e forma de pagamento

Companheiro de `spec.md`: registra as decisões de produto tomadas durante o Specify e o gate de
prontidão antes do Design.

**Última atualização:** 2026-07-13

---

## Decisões de zonas cinzentas

| # | Questão | Opções consideradas | Decisão | Quem decidiu |
| --- | --- | --- | --- | --- |
| D1 | O planejamento deve variar por pagamento? | Somente categoria / forma exata / conta ou cartão | Distribuir por conta ou cartão; forma exata fica na realização. | Ana |
| D2 | Pix e débito são fontes? | Fontes independentes / formas associadas à conta | São formas sem saldo próprio, associadas a uma ou mais contas. | Ana |
| D3 | Como representar os saldos Flash? | Um cartão com carteiras / duas contas / instrumento separado | `Flash Alimentação` e `Flash Conveniência` são duas contas pré-pagas com saldo independente. | Ana |
| D4 | O cartão físico Flash precisa de cadastro? | Entidade própria / apenas forma pré-paga | Não; `cartão pré-pago` é a forma usada nas contas Flash. | Ana |
| D5 | Saldo Flash reinicia no mês? | Reinicia / acumula | Acumula entre meses. | Ana |
| D6 | O sistema deve impor uma meta de crédito? | Meta configurável / meta automática / transparência | Não haverá meta; serão mostrados valores planejados, realizados, faturados e impacto nos saldos. | Ana |
| D7 | Como representar cartão de crédito? | Conta com saldo / forma comum / obrigação separada | Entidade separada, com fatura e conta pagadora padrão. | Ana |
| D8 | Como tratar carga do benefício? | Receita livre / entrada restrita / transferência | Carga da empresa é entrada restrita na conta Flash; recarga própria é transferência. | Ana + regra financeira proposta |
| D9 | Categorias permitidas pelo benefício bloqueiam compra? | Bloqueio / alerta / fora do escopo | Bloqueio rígido fica fora desta entrega; a aceitação varia por estabelecimento. | Ana + suposição não bloqueante |
| D10 | Planejamento incompleto pode ser salvo? | Bloquear / salvar como rascunho / salvar incompleto | Permitir salvar e exibir `Não distribuído`, marcando o planejamento como incompleto. | Ana |
| D11 | Carga empresarial do Flash conta como receita livre? | Receita livre / benefício separado / não exibir | Exibir como `Benefício recebido`, separado da receita livre e sem aumentar o caixa bancário. | Ana |
| D12 | Compatibilidade com código e bancos do protótipo | Preservar legado / migração compatível / limpeza destrutiva | Remover código morto comprovado, consolidar migrações e reconstruir bancos de desenvolvimento; backups ficam protegidos. | Ana |

---

## Gate de prontidão de contexto

| Eixo | Status |
| --- | --- |
| Problema / para quem | ok |
| Sucesso mensurável | ok |
| Restrições (prazo / compliance / contrato) | lacuna |
| Integrações + modos de falha | ok |
| Conhecido vs assumido | lacuna |

### Registro de Suposições & Perguntas Abertas

| # | Pergunta aberta | Dono | Bloqueia? | Suposição se seguirmos | Status |
| --- | --- | --- | --- | --- | --- |
| Q1 | Um planejamento pode ser salvo com parte ainda não distribuída ou só como rascunho? | sponsor | não | Mostrar `Não distribuído` e permitir salvar, mas considerar o planejamento incompleto. | resolvida |
| Q2 | Existe prazo desejado para esta entrega? | sponsor | não | Priorizar correção financeira e usabilidade sem data fixa. | aberta |
| Q3 | Quais formas devem ser sugeridas por padrão para cada tipo de conta? | engenheiro | não | Conta corrente sugere Pix e débito; benefício pré-pago sugere pré-pago; todas podem ser ajustadas. | resolvida no Design |
| Q4 | Como migrar os orçamentos atuais sem origem? | engenheiro | não | Recriar a base de desenvolvimento, conforme autorização prévia para migração destrutiva; não inferir origem. | resolvida no Design |
| Q5 | Cargas empresariais do Flash devem participar do total de receitas do mês? | sponsor | não | Mostrar como `Benefício recebido`, separado da receita livre e do caixa bancário. | resolvida |

**Saída do gate:**

- [x] Nenhuma linha com **Bloqueia = sim** em aberto.
- [x] Toda suposição **não-bloqueante** tem dono e será revisitada no Design/validação.

O Specify está aprovado. As perguntas restantes são não bloqueantes e devem ser verificadas no
Design; nenhuma decisão de produto impede a próxima fase.
