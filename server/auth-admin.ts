import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

const AUTH_FILE = "admin-auth.json";
const SCRYPT_KEYLEN = 64;
const SALT_LEN = 16;

function getDataDir(): string {
  return join(process.cwd(), "data");
}

function getAuthPath(): string {
  return join(getDataDir(), AUTH_FILE);
}

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface AdminAuth {
  username: string;
  passwordHash: string;
}

async function ensureDataDir(): Promise<void> {
  const dataDir = getDataDir();
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

/** Create admin-auth.json from env if it doesn't exist. Call at startup. */
export async function ensureAuthFile(): Promise<void> {
  const path = getAuthPath();
  try {
    await fs.access(path);
    return;
  } catch {
    /* file missing, create from env */
  }
  await ensureDataDir();
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "password";
  const auth: AdminAuth = {
    username,
    passwordHash: hashPassword(password),
  };
  await fs.writeFile(path, JSON.stringify(auth, null, 2), "utf-8");
}

export async function loadAuth(): Promise<AdminAuth> {
  const path = getAuthPath();
  const raw = await fs.readFile(path, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (typeof data?.username !== "string" || typeof data?.passwordHash !== "string") {
    throw new Error("Invalid admin-auth.json");
  }
  return { username: data.username, passwordHash: data.passwordHash };
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const auth = await loadAuth();
  if (auth.username !== username) return false;
  return verifyPassword(password, auth.passwordHash);
}

export async function updateAdminPassword(newPassword: string): Promise<void> {
  const auth = await loadAuth();
  auth.passwordHash = hashPassword(newPassword);
  await ensureDataDir();
  await fs.writeFile(getAuthPath(), JSON.stringify(auth, null, 2), "utf-8");
}
