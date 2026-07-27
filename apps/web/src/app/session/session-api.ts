import { z } from "zod";
import { apiClient } from "../shared/api-client";

export const sessionUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.literal("owner")
});
export const sessionSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }),
  z.object({ authenticated: z.literal(true), user: sessionUserSchema })
]);
export type SessionState = z.infer<typeof sessionSchema>;
export const sessionApi = {
  get: () => apiClient.get("/session", sessionSchema),
  login: (username: string, password: string) =>
    apiClient.post("/session/login", { username, password }, sessionSchema),
  logout: () => apiClient.post("/session/logout", undefined, z.undefined()),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post("/session/change-password", { currentPassword, newPassword }, sessionSchema)
};
