import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

export type Session = {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
};

const SESSION_COOKIE = "sme_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const ALG = "HS256";

function isProduction(): boolean {
  return (process.env.NODE_ENV as string) === "production";
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set it to a 32+ char value (e.g. `openssl rand -hex 32`).",
    );
  }
  return new TextEncoder().encode(secret);
}

async function mintToken(session: Session): Promise<string> {
  return new SignJWT({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

async function readToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: typeof payload.name === "string" ? payload.name : null,
        image: typeof payload.image === "string" ? payload.image : null,
      },
    };
  } catch {
    return null;
  }
}

async function writeSessionCookie(session: Session): Promise<void> {
  const token = await mintToken(session);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readToken(token);
}

export const auth = getSession;

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function signIn(email: string): Promise<Session> {
  if (isProduction()) {
    throw new Error(
      "Dev sign-in is disabled in production. Wire up the AD adapter before deploying.",
    );
  }
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }
  const user = await db.user.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized },
  });
  const session: Session = {
    user: { id: user.id, email: normalized, name: user.name, image: user.image },
  };
  await writeSessionCookie(session);
  return session;
}

export async function refreshSession(): Promise<Session | null> {
  const current = await getSession();
  if (!current) return null;
  const user = await db.user.findUnique({ where: { id: current.user.id } });
  if (!user || !user.email) return current;
  const next: Session = {
    user: { id: user.id, email: user.email, name: user.name, image: user.image },
  };
  await writeSessionCookie(next);
  return next;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
