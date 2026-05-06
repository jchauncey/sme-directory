import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export type StoredObject = { url: string; key: string };

export interface StorageAdapter {
  put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

const PUBLIC_URL_PREFIX = "/uploads";

function getLocalRoot(): string {
  const override = process.env.AVATAR_LOCAL_DIR;
  if (override) return override;
  return path.join(process.cwd(), "public", "uploads");
}

class LocalStorage implements StorageAdapter {
  async put(key: string, bytes: Buffer): Promise<StoredObject> {
    const root = getLocalRoot();
    const target = path.join(root, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
    const url =
      process.env.AVATAR_LOCAL_DIR && process.env.AVATAR_LOCAL_PUBLIC_URL
        ? `${process.env.AVATAR_LOCAL_PUBLIC_URL.replace(/\/$/, "")}/${key}`
        : `${PUBLIC_URL_PREFIX}/${key}`;
    return { url, key };
  }

  async delete(key: string): Promise<void> {
    const root = getLocalRoot();
    const target = path.join(root, key);
    try {
      await fs.unlink(target);
    } catch {
      // best-effort
    }
  }
}

class UnconfiguredStorage implements StorageAdapter {
  constructor(private readonly provider: string) {}
  async put(): Promise<StoredObject> {
    throw new Error(
      `STORAGE_PROVIDER="${this.provider}" is not yet implemented. Wire up the adapter (e.g. @aws-sdk/client-s3 or @vercel/blob) before deploying.`,
    );
  }
  async delete(): Promise<void> {
    // no-op
  }
}

let cached: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (provider === "local") {
    cached = new LocalStorage();
  } else {
    cached = new UnconfiguredStorage(provider);
  }
  return cached;
}

export function resetStorageForTests(): void {
  cached = null;
}
