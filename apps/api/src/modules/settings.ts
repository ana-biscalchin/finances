import { settings as dbSettings } from "@finances/database";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { createDatabaseConnection } from "@finances/database";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseOptionalString, isRecord } from "../http.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export function registerSettingsRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  // Helper to get a setting value
  async function getSetting(key: string): Promise<string | null> {
    const row = db.select().from(dbSettings).where(eq(dbSettings.key, key)).get();
    return row?.value ?? null;
  }

  // Helper to save a setting value
  async function setSetting(key: string, value: string | null) {
    if (value === null) {
      db.delete(dbSettings).where(eq(dbSettings.key, key)).run();
      return;
    }
    const existing = db.select().from(dbSettings).where(eq(dbSettings.key, key)).get();
    if (existing) {
      db.update(dbSettings)
        .set({ value, updatedAt: new Date().toISOString() })
        .where(eq(dbSettings.key, key))
        .run();
    } else {
      db.insert(dbSettings)
        .values({ key, value })
        .run();
    }
  }

  // Helper to refresh and get a valid Google access token
  async function getValidAccessToken(): Promise<string> {
    const clientId = await getSetting("google_client_id");
    const clientSecret = await getSetting("google_client_secret");
    const refreshToken = await getSetting("google_refresh_token");

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Google Drive não está conectado ou configurado.");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`Falha ao atualizar token de acesso do Google: ${errBody}`);
    }

    const data = (await tokenRes.json()) as { access_token: string };
    await setSetting("google_access_token", data.access_token);
    return data.access_token;
  }

  // Helper to find or create the Google Drive backup folder
  async function getOrCreateFolder(accessToken: string): Promise<string> {
    const query = encodeURIComponent("name = 'Carteira da Ana' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!listRes.ok) {
      throw new Error("Falha ao buscar pasta no Google Drive.");
    }

    const listData = (await listRes.json()) as { files: { id: string }[] };
    if (listData.files.length > 0) {
      return listData.files[0].id;
    }

    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Carteira da Ana",
        mimeType: "application/vnd.google-apps.folder"
      })
    });

    if (!createRes.ok) {
      throw new Error("Falha ao criar pasta 'Carteira da Ana' no Google Drive.");
    }

    const createData = (await createRes.json()) as { id: string };
    return createData.id;
  }

  // 1. GET Settings state
  app.get("/settings", async () => {
    const clientId = await getSetting("google_client_id");
    const clientSecret = await getSetting("google_client_secret");
    const syncEnabled = (await getSetting("google_sync_enabled")) === "true";
    const refreshToken = await getSetting("google_refresh_token");
    const accountEmail = await getSetting("google_account_email");

    return {
      googleClientId: clientId || "",
      googleClientSecret: clientSecret ? "********" : "",
      hasGoogleClientSecret: !!clientSecret,
      googleSyncEnabled: syncEnabled,
      googleConnected: !!refreshToken,
      googleAccountEmail: accountEmail || ""
    };
  });

  // 2. POST Save Settings
  app.post("/settings", async (req, reply) => {
    const body = req.body;
    if (!isRecord(body)) {
      reply.code(400).send({ message: "Payload inválido" });
      return;
    }

    const clientId = parseOptionalString(body.googleClientId, "googleClientId");
    const clientSecret = parseOptionalString(body.googleClientSecret, "googleClientSecret");
    const syncEnabled = body.googleSyncEnabled !== undefined ? String(body.googleSyncEnabled === true) : undefined;

    if (clientId !== undefined) {
      await setSetting("google_client_id", clientId);
    }
    if (clientSecret !== undefined && clientSecret !== "********" && clientSecret !== "") {
      await setSetting("google_client_secret", clientSecret);
    } else if (clientSecret === "") {
      await setSetting("google_client_secret", null);
    }
    if (syncEnabled !== undefined) {
      await setSetting("google_sync_enabled", syncEnabled);
    }

    return { success: true };
  });

  // 3. POST Generate Google Auth URL
  app.post("/auth/google/url", async (req, reply) => {
    const clientId = await getSetting("google_client_id");
    if (!clientId) {
      reply.code(400).send({ message: "Google Client ID não configurado nas configurações." });
      return;
    }

    const redirectUri = "http://localhost:3000/auth/google/callback";
    const scope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

    return { url: authUrl };
  });

  // 4. GET Google OAuth Callback
  app.get("/auth/google/callback", async (req, reply) => {
    const query = req.query as Record<string, unknown>;
    const code = typeof query.code === "string" ? query.code : "";
    if (!code) {
      reply.code(400).send({ message: "Código de autorização ausente." });
      return;
    }

    const clientId = await getSetting("google_client_id");
    const clientSecret = await getSetting("google_client_secret");
    if (!clientId || !clientSecret) {
      reply.code(400).send({ message: "Configurações do Google OAuth incompletas." });
      return;
    }

    const redirectUri = "http://localhost:3000/auth/google/callback";

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        throw new Error(`Erro ao obter tokens: ${errBody}`);
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      await setSetting("google_access_token", tokens.access_token);
      if (tokens.refresh_token) {
        await setSetting("google_refresh_token", tokens.refresh_token);
      }

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      if (userInfoRes.ok) {
        const userInfo = (await userInfoRes.json()) as { email?: string };
        if (userInfo.email) {
          await setSetting("google_account_email", userInfo.email);
        }
      }

      reply.redirect("http://localhost:5173/?googleAuth=success");
    } catch (error) {
      app.log.error({ err: error }, "Erro no callback do Google OAuth");
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      reply.redirect(`http://localhost:5173/?googleAuth=error&message=${encodeURIComponent(message)}`);
    }
  });

  // 5. POST Disconnect Google Drive
  app.post("/auth/google/disconnect", async () => {
    await setSetting("google_access_token", null);
    await setSetting("google_refresh_token", null);
    await setSetting("google_account_email", null);
    return { success: true };
  });

  // 6. GET Google Drive Backups List
  app.get("/backups/gdrive", async (req, reply) => {
    try {
      const accessToken = await getValidAccessToken();
      const folderId = await getOrCreateFolder(accessToken);

      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!listRes.ok) {
        const errText = await listRes.text();
        throw new Error(`Falha ao listar arquivos no Google Drive: ${errText}`);
      }

      const listData = (await listRes.json()) as {
        files: { id: string; name: string; size?: string; createdTime: string }[];
      };

      return listData.files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size ? parseInt(f.size, 10) : 0,
        createdAt: f.createdTime
      }));
    } catch (error) {
      app.log.error({ err: error }, "Erro ao listar backups do Google Drive");
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      reply.code(500).send({ message });
    }
  });

  // 7. POST Upload Backup to Google Drive
  app.post("/backups/:name/upload-gdrive", async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const name = params.name;
    if (!name || typeof name !== "string" || name.includes("/") || name.includes("\\") || name.startsWith(".")) {
      reply.code(400).send({ message: "Nome de arquivo de backup inválido." });
      return;
    }

    const backupsDir = resolve(process.cwd(), "../../data/backups");
    const backupFilePath = resolve(backupsDir, name);
    if (!existsSync(backupFilePath)) {
      reply.code(404).send({ message: "Arquivo de backup não encontrado localmente." });
      return;
    }

    try {
      const accessToken = await getValidAccessToken();
      const folderId = await getOrCreateFolder(accessToken);

      // Check if file with same name already exists in folder to avoid duplicates
      const escapedName = name.replace(/'/g, "\\'");
      const checkQuery = encodeURIComponent(`'${folderId}' in parents and name = '${escapedName}' and trashed = false`);
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${checkQuery}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      let existingFileId: string | null = null;
      if (checkRes.ok) {
        const checkData = (await checkRes.json()) as { files: { id: string }[] };
        if (checkData.files.length > 0) {
          existingFileId = checkData.files[0].id;
        }
      }

      let fileId = existingFileId;

      if (!fileId) {
        // Create file metadata
        const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            parents: [folderId]
          })
        });

        if (!metaRes.ok) {
          const errText = await metaRes.text();
          throw new Error(`Falha ao criar metadados no Google Drive: ${errText}`);
        }

        const fileMetadata = (await metaRes.json()) as { id: string };
        fileId = fileMetadata.id;
      }

      // Upload content
      const fileBuffer = readFileSync(backupFilePath);
      const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-sqlite3"
        },
        body: fileBuffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Falha ao enviar arquivo para o Google Drive: ${errText}`);
      }

      return { success: true, googleFileId: fileId };
    } catch (error) {
      app.log.error({ err: error }, "Erro ao enviar backup para o Google Drive");
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      reply.code(500).send({ message });
    }
  });

  // 8. POST Download Backup from Google Drive
  app.post("/backups/gdrive/:id/download", async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const fileId = params.id;
    if (!fileId || typeof fileId !== "string") {
      reply.code(400).send({ message: "ID do arquivo inválido." });
      return;
    }

    try {
      const accessToken = await getValidAccessToken();

      // Get file metadata to know the filename
      const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!metaRes.ok) {
        const errText = await metaRes.text();
        throw new Error(`Falha ao obter metadados do arquivo do Google Drive: ${errText}`);
      }

      const fileMetadata = (await metaRes.json()) as { name: string };
      const filename = fileMetadata.name;

      if (filename.includes("/") || filename.includes("\\") || filename.startsWith(".")) {
        reply.code(400).send({ message: "Nome de arquivo do Google Drive inválido." });
        return;
      }

      // Download content
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!downloadRes.ok) {
        const errText = await downloadRes.text();
        throw new Error(`Falha ao baixar arquivo do Google Drive: ${errText}`);
      }

      const arrayBuffer = await downloadRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const backupsDir = resolve(process.cwd(), "../../data/backups");
      mkdirSync(backupsDir, { recursive: true });
      const destPath = resolve(backupsDir, filename);

      writeFileSync(destPath, buffer);

      return { success: true, name: filename };
    } catch (error) {
      app.log.error({ err: error }, "Erro ao baixar backup do Google Drive");
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      reply.code(500).send({ message });
    }
  });
}
