import { buildDemoSeedData } from "./demo-seed-data.js";
import { categorySeeds } from "./seed-data.js";

const localPasswordHash =
  "$argon2id$v=19$m=19456,t=2,p=1$7s4+9H2UDeVSKb1S+IvOHg$XLTvt1TcsVRbFD91tLN8+y+IqyGG2w1h09hIZmWMrAw";

export function resolveLocalUserSeed(environment: NodeJS.ProcessEnv) {
  if (environment.SEED_LOCAL_USER !== "true") return null;

  const demoSeed = buildDemoSeedData("2026-08");

  return {
    id: "local-owner-ana",
    username: "ana",
    password: "ana123",
    passwordHash: localPasswordHash,
    role: "owner" as const,
    isActive: true,
    passwordChangedAt: "2026-08-24T00:00:00.000Z",
    accounts: demoSeed.accounts,
    accountPaymentMethods: demoSeed.accountPaymentMethods,
    creditCards: demoSeed.creditCards,
    categories: categorySeeds
  };
}
