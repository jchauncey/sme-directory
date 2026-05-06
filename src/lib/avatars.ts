import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getGroupBySlugOrThrow } from "@/lib/groups";
import { ConflictError, assertOwner } from "@/lib/memberships";
import { getStorage } from "@/lib/storage";

export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const MAX_BYTES = 2 * 1024 * 1024;

const EXT_BY_MIME: Record<AllowedMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export class InvalidImageError extends Error {
  readonly code = "INVALID_IMAGE" as const;
  constructor(message = "Image must be a PNG, JPEG, or WebP file.") {
    super(message);
    this.name = "InvalidImageError";
  }
}

export class ImageTooLargeError extends Error {
  readonly code = "IMAGE_TOO_LARGE" as const;
  constructor(message = "Image is larger than 2 MB.") {
    super(message);
    this.name = "ImageTooLargeError";
  }
}

function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(mime);
}

function makeKey(scope: "users" | "groups", id: string, mime: AllowedMime): string {
  const ext = EXT_BY_MIME[mime];
  const rand = randomBytes(6).toString("hex");
  return `avatars/${scope}/${id}-${rand}.${ext}`;
}

async function readFile(file: File): Promise<{ bytes: Buffer; mime: AllowedMime }> {
  const mime = file.type;
  if (!isAllowedMime(mime)) {
    throw new InvalidImageError();
  }
  if (file.size > MAX_BYTES) {
    throw new ImageTooLargeError();
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    throw new ImageTooLargeError();
  }
  return { bytes, mime };
}

export async function setUserAvatar(userId: string, file: File): Promise<{ image: string }> {
  const { bytes, mime } = await readFile(file);
  const key = makeKey("users", userId, mime);
  const stored = await getStorage().put(key, bytes, mime);
  await db.user.update({ where: { id: userId }, data: { image: stored.url } });
  return { image: stored.url };
}

export async function clearUserAvatar(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { image: null } });
}

export async function setGroupAvatar(
  slug: string,
  file: File,
  actorUserId: string,
): Promise<{ image: string }> {
  const group = await getGroupBySlugOrThrow(slug);
  await assertOwner(group.id, actorUserId);
  if (group.archivedAt) {
    throw new ConflictError("This group is archived and is read-only.");
  }
  const { bytes, mime } = await readFile(file);
  const key = makeKey("groups", group.id, mime);
  const stored = await getStorage().put(key, bytes, mime);
  await db.group.update({ where: { id: group.id }, data: { image: stored.url } });
  return { image: stored.url };
}

export async function clearGroupAvatar(slug: string, actorUserId: string): Promise<void> {
  const group = await getGroupBySlugOrThrow(slug);
  await assertOwner(group.id, actorUserId);
  if (group.archivedAt) {
    throw new ConflictError("This group is archived and is read-only.");
  }
  await db.group.update({ where: { id: group.id }, data: { image: null } });
}
