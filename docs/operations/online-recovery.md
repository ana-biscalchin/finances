# Recuperação e exportação online

O PostgreSQL hospedado é a fonte de verdade do release online. Backups operacionais,
retenção e PITR pertencem ao provedor do banco e não dependem do filesystem efêmero da API.
Restauração completa é um procedimento operacional: confirmar o alvo (staging ou produção),
criar um ponto de recuperação, executar o restore pelo provedor, validar login, contas,
totais mensais e transferências, e registrar o resultado.

Usuários autenticados podem usar `GET /api/export` para baixar uma exportação JSON somente
dos próprios dados. A resposta não é persistida pela API, usa `Cache-Control: no-store` e
exclui configurações legadas do Google Drive. O arquivo exportado deve ser tratado como
sensível e apagado após o uso.

As rotas de backup/restauração integral de SQLite continuam disponíveis apenas no runtime
SQLite legado; não são registradas quando a conexão PostgreSQL é usada.
