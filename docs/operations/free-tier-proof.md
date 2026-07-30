# Prova de topologia gratuita — T1

**Data:** 2026-07-27

## Resultado

- Render CLI autenticada no workspace `My Workspace`.
- Web Service gratuito `finances-api` acessível por HTTPS em `https://finances-api-cnuy.onrender.com`.
- `/health` respondeu com sucesso após cold start em aproximadamente 23 segundos.
- Neon acessível no projeto `finances`, região AWS Ohio (`us-east-2`), PostgreSQL 18.
- Conexão SQL TLS validada com consulta somente leitura; credenciais não foram registradas.
- O serviço-alvo serve o build Vite e a API Fastify na mesma origem; rotas de negócio usam `/api`.

## Limites e decisão de custo

- Render Free e Neon Free não têm SLA assumido. Cold start e suspensão são aceitáveis para uso pessoal inicial.
- O filesystem do Render é efêmero e nunca é fonte de persistência.
- Secrets ficam somente nos painéis do Render/Neon; logs usam redaction.
- Nenhuma cobrança, plano pago ou recurso faturável pode ser ativado sem aprovação explícita da Ana.
- Abandonar o plano gratuito se houver perda de dados, restauração incompatível com RPO de 24 horas, cold start recorrente acima de 60 segundos ou indisponibilidade que impeça o uso pessoal.

## Persistência, backup e restauração

A prova usa apenas dados sintéticos. A persistência entre deploys é do Neon, não do filesystem do Render. O teste operacional mínimo:

1. aplicar migrations por job controlado;
2. inserir marcador sintético;
3. realizar novo deploy e confirmar o marcador;
4. criar branch de restauração a partir do histórico do Neon;
5. confirmar o marcador na branch restaurada;
6. excluir a branch de prova somente após confirmação.

O ensaio de restauração completo e o registro dos identificadores ficam no log operacional de staging. Produção não será liberada antes desse ensaio.

## Gate

A topologia gratuita está tecnicamente aprovada para continuar T2–T4. Ainda não está aprovada para dados pessoais: autenticação, ownership, migração PostgreSQL completa e restore drill são gates posteriores.
