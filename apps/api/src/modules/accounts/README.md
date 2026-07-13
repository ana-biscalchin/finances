# Associações de formas de pagamento

Contas carregam saldo; formas de pagamento descrevem como esse saldo é movimentado. Este módulo valida, substitui e consulta as associações conta–forma usadas pelo cadastro, lançamentos, recorrências e pagamentos de fatura.

Invariantes: referências precisam existir e estar ativas para novos usos; uma conta possui no máximo uma forma padrão; arquivamento preserva histórico; despesas de consumo em conta exigem associação ativa. Persistência é atômica com a edição da conta.
