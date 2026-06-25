# Estratégia de Backup Local do SQLite

Este documento descreve a estratégia técnica e as regras de negócio para a criação, listagem e restauração de backups do banco de dados local SQLite.

## Motivação e Objetivos

Como o aplicativo é executado localmente em `localhost` e armazena dados confidenciais de finanças pessoais, é essencial fornecer um mecanismo simples e robusto de backup e restauração de dados para:
1. Prevenir perda de dados por falha de hardware ou corrupção de arquivos.
2. Permitir que o usuário exporte ou mova seus dados de forma independente.
3. Garantir segurança ao realizar operações de restauração, impedindo sobrescrever dados acidentalmente sem um ponto de recuperação.

---

## 1. Local de Armazenamento e Versionamento

- **Diretório:** Todos os backups locais serão armazenados no diretório `data/backups/` na raiz do projeto.
- **Git Ignore:** O diretório `data/` e os arquivos `.sqlite` já estão ignorados no `.gitignore`, garantindo que backups contendo dados pessoais sensíveis **nunca** sejam enviados para repositórios remotos de código.

---

## 2. Nomenclatura dos Arquivos

Os arquivos de backup serão salvos no formato SQLite padrão (`.sqlite`) e nomeados com base no momento de sua criação:

*   **Backups Manuais/Automáticos:** `backup-YYYY-MM-DD-HHmmss.sqlite`
    *   *Exemplo:* `backup-2026-06-23-113000.sqlite`
*   **Backups de Segurança (pré-restauração):** `pre-restore-YYYY-MM-DD-HHmmss.sqlite`
    *   *Exemplo:* `pre-restore-2026-06-23-113115.sqlite`

Essa diferenciação facilita identificar backups normais e backups automáticos criados pelo sistema logo antes de uma restauração.

---

## 3. Mecanismo Técnico (Online Backup/Restore)

Como o banco de dados do aplicativo utiliza o modo WAL (`journal_mode = WAL`) e transações concorrentes/assíncronas podem ocorrer, a cópia direta do arquivo via sistema de arquivos (`fs.copyFileSync`) do banco de dados ativo é desencorajada por risco de corrupção ou perda de transações recentes não persistidas no arquivo principal.

### Criação de Backup (Online Backup)
Utilizamos a API de backup online nativa do SQLite, exposta pelo `better-sqlite3` através do método `db.backup(destinationPath)`.
*   **Vantagem:** Realiza a cópia de forma transacional segura e consistente, mesmo se houver conexões ou transações ativas.

### Restauração de Backup (Online Restore)
Para restaurar, abrimos uma conexão temporária com o arquivo de backup e realizamos a operação inversa, isto é, fazemos o backup *da conexão temporária do backup para o caminho do banco de dados principal*.
*   **Vantagem:** O SQLite atualiza as páginas de dados na conexão principal ativa de forma segura e transparente. Isso evita a necessidade de fechar a conexão ativa da API Fastify e recriar instâncias do Drizzle ORM, o que quebraria referências em handlers de rotas já registrados.

---

## 4. Medidas de Segurança Obrigatórias

Para evitar desastres de perda de dados durante a restauração:

1.  **Validação do Backup:** Antes de aplicar qualquer arquivo de backup na restauração, a API abrirá uma conexão de leitura rápida no arquivo para executar o comando `PRAGMA integrity_check` e verificar a validade do arquivo SQLite. Se falhar, a restauração é abortada.
2.  **Ponto de Recuperação (Pre-Restore Backup):** Imediatamente antes de aplicar o backup validado, o sistema cria automaticamente um backup completo do estado atual com o prefixo `pre-restore-`.
3.  **Confirmação do Usuário:** O frontend deve exigir confirmação explícita em modal/diálogo antes de disparar o comando de restauração.

---

## 5. Endpoints da API

*   `POST /backups/create`: Cria um novo backup. Retorna o nome do arquivo criado e o tamanho.
*   `GET /backups`: Lista os backups existentes ordenados do mais recente para o mais antigo.
*   `POST /backups/:name/restore`: Valida o arquivo, cria o backup `pre-restore-`, executa a restauração online e retorna confirmação.

---

## 6. Interface de Usuário (Tela de Configurações)

Na tela de **Configurações** (`settings`), a seção de backups permitirá:
*   Visualizar o caminho local de armazenamento dos dados para controle do usuário.
*   Botão para **Criar Backup Manual**.
*   Tabela com o histórico de backups (Nome, Data/Hora de criação, Tamanho, Tipo).
*   Ação de **Restaurar** com confirmação de segurança (onde o usuário digita explicitamente "RESTAURAR" ou clica em uma confirmação dupla).
*   Ação de **Excluir** arquivo de backup obsoleto.
