import {
  resolveDatabasePath,
  restoreDatabaseOnline,
  validateDatabaseIntegrity,
  type createDatabaseConnection
} from "@finances/database";
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

function getTimestampString() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${datePart}-${timePart}`;
}

export function registerBackupRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const mainDbPath = resolveDatabasePath();
  const dbDir = dirname(mainDbPath);
  const backupsDir = resolve(dbDir, "backups");

  const getBackupsDir = () => {
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true });
    }
    return backupsDir;
  };

  // Helper to validate filename pattern and avoid path traversal
  const isValidBackupName = (name: string) => {
    const pattern = /^(backup|pre-restore)-\d{4}-\d{2}-\d{2}-\d{6}\.sqlite$/;
    return pattern.test(name);
  };

  // 1. POST /backups/create
  app.post("/backups/create", async (request, reply) => {
    const dir = getBackupsDir();
    const timestamp = getTimestampString();
    const destPath = resolve(dir, `backup-${timestamp}.sqlite`);

    try {
      // Execute online backup
      await connection.sqlite.backup(destPath);

      const stats = statSync(destPath);
      const filename = basename(destPath);

      app.log.info({ filename }, "Backup local criado com sucesso.");

      return reply.code(201).send({
        name: filename,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString(),
        type: "manual"
      });
    } catch (error) {
      app.log.error({ err: error }, "Falha ao criar backup.");
      return reply.code(500).send({ message: "Falha ao criar backup local do banco de dados." });
    }
  });

  // 2. GET /backups
  app.get("/backups", async () => {
    const dir = getBackupsDir();
    const files = readdirSync(dir);

    const backupFiles = files
      .filter((file) => isValidBackupName(file))
      .map((file) => {
        const filePath = resolve(dir, file);
        const stats = statSync(filePath);
        const type = file.startsWith("pre-restore-") ? "pre_restore" : "manual";

        return {
          name: file,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
          type
        };
      });

    // Sort descending by name (lexicographically, which is equivalent to chronological descending due to YYYY-MM-DD-HHmmss format)
    return backupFiles.sort((a, b) => b.name.localeCompare(a.name));
  });

  // 3. POST /backups/:name/restore
  app.post("/backups/:name/restore", async (request, reply) => {
    const { name } = request.params as { name: string };

    if (!isValidBackupName(name)) {
      return reply.code(400).send({ message: "Nome de backup inválido." });
    }

    const dir = getBackupsDir();
    const backupPath = resolve(dir, name);

    if (!existsSync(backupPath)) {
      return reply.code(404).send({ message: "Arquivo de backup não encontrado." });
    }

    // Step 1: Validate database integrity of the backup file using the package helper
    const isValid = validateDatabaseIntegrity(backupPath);
    if (!isValid) {
      app.log.error({ backupPath }, "Validação de integridade do backup falhou.");
      return reply.code(400).send({
        message: "O arquivo de backup selecionado está corrompido ou é inválido para restauração."
      });
    }

    // Step 2: Create a safety backup (pre-restore) of the current database state
    const timestamp = getTimestampString();
    const preRestorePath = resolve(dir, `pre-restore-${timestamp}.sqlite`);

    try {
      await connection.sqlite.backup(preRestorePath);
      app.log.info({ path: preRestorePath }, "Backup de segurança pré-restauração criado com sucesso.");
    } catch (error) {
      app.log.error({ err: error }, "Falha ao criar backup de segurança pré-restauração.");
      return reply.code(500).send({
        message: "Falha de segurança: não foi possível criar o backup de segurança antes da restauração."
      });
    }

    // Step 3: Restore the backup using the package helper
    try {
      await restoreDatabaseOnline(backupPath, mainDbPath);
      app.log.info({ backupPath }, "Backup restaurado com sucesso.");
      return { success: true, message: "Banco de dados restaurado com sucesso." };
    } catch (error) {
      app.log.error({ err: error }, "Falha ao restaurar banco de dados.");
      return reply.code(500).send({ message: "Falha crítica durante a restauração dos dados." });
    }
  });

  // 4. DELETE /backups/:name
  app.delete("/backups/:name", async (request, reply) => {
    const { name } = request.params as { name: string };

    if (!isValidBackupName(name)) {
      return reply.code(400).send({ message: "Nome de backup inválido." });
    }

    const dir = getBackupsDir();
    const backupPath = resolve(dir, name);

    if (!existsSync(backupPath)) {
      return reply.code(404).send({ message: "Arquivo de backup não encontrado." });
    }

    try {
      unlinkSync(backupPath);
      app.log.info({ filename: name }, "Backup excluído com sucesso.");
      return reply.code(204).send();
    } catch (error) {
      app.log.error({ err: error }, "Falha ao excluir backup.");
      return reply.code(500).send({ message: "Falha ao excluir o arquivo de backup local." });
    }
  });
}
