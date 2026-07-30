# Deploy, promoção e rollback

## Ambientes

- `staging`: serviço Render e projeto/branch Neon exclusivos, sem dados pessoais.
- `production`: serviço Render e projeto Neon exclusivos. Não compartilha usuária, banco, sessão ou secrets com staging.
- O artefato recebe o SHA do commit. Produção só promove um SHA aprovado em staging; não recompila código diferente.

## Pipeline

1. Pull requests executam formatação, lint, typecheck, testes e build.
2. A CI empacota `apps/api/dist`, `apps/web/dist` e pacotes compilados como `finances-<sha>.tar.gz`.
3. Staging só implanta após os checks passarem.
4. Migrations são executadas em job manual, antes da promoção, com backup e verificação de compatibilidade.
5. O startup da API nunca executa migration destrutiva.
6. Produção exige aprovação manual no ambiente protegido do GitHub/Render.

## Smoke de staging

Validar no mesmo host HTTPS:

```bash
curl --fail https://<staging>.onrender.com/health/live
curl --fail https://<staging>.onrender.com/health/ready
curl --fail https://<staging>.onrender.com/
```

Confirmar headers de segurança, ausência de CORS para origem não permitida e ausência de secrets nos logs.

## Rollback

1. Interromper novas promoções.
2. Selecionar no Render o deploy saudável do SHA anterior.
3. Se houve migration de expansão compatível, manter o schema e reimplantar o artefato anterior.
4. Se a migration não for retrocompatível, não promover; restaurar staging a partir do ponto criado antes do job.
5. Repetir os três smokes e registrar SHA, horário e resultado.

O rollback deve ser ensaiado em staging antes do go-live. Nenhum rollback pode apagar dados ou executar migration reversa sem revisão e confirmação.

## Dívida de baseline

O repositório anterior à T4 possui arquivos legados fora do Prettier. A CI verifica inicialmente a fronteira online alterada por `pnpm format:online`; ampliar o escopo requer um commit mecânico separado, sem misturar regras financeiras ou a configuração pessoal de `.vscode`.
