"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "@/lib/auth";

type SessionContextValue = {
  data: Session | null;
  status: "authenticated" | "unauthenticated";
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialSession,
  children,
}: {
  initialSession: Session | null;
  children: ReactNode;
}) {
  const value: SessionContextValue = {
    data: initialSession,
    status: initialSession ? "authenticated" : "unauthenticated",
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return ctx;
}
