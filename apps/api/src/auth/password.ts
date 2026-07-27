import { hash, verify, type Options } from "@node-rs/argon2";

const argon2idOptions: Options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32
};

export function hashPassword(password: string) {
  return hash(password, argon2idOptions);
}

export function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password, argon2idOptions);
}
