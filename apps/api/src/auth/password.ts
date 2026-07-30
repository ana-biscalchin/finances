import { hash, verify, type Options } from "@node-rs/argon2";

const argon2idOptions: Options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32
};

export async function hashPassword(password: string) {
  return await hash(password, argon2idOptions);
}

export async function verifyPassword(passwordHash: string, password: string) {
  return await verify(passwordHash, password, argon2idOptions);
}
