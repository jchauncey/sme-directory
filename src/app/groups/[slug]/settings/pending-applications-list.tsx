"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type PendingApplicationView = {
  userId: string;
  email: string | null;
  name: string | null;
  appliedAt: string;
};

type Props = {
  slug: string;
  applications: PendingApplicationView[];
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function PendingApplicationsList({ slug, applications }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (applications.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending applications.</p>;
  }

  async function decide(userId: string, status: "approved" | "rejected") {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/groups/${slug}/membership/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success(status === "approved" ? "Application approved." : "Application rejected.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="divide-y rounded-md border">
      {applications.map((a) => (
        <li key={a.userId} className="flex items-center justify-between gap-4 p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{a.name ?? a.email ?? a.userId}</p>
            {a.name && a.email ? <p className="text-xs text-muted-foreground">{a.email}</p> : null}
            <p className="text-xs text-muted-foreground">
              Applied {new Date(a.appliedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={busyId !== null}
              onClick={() => decide(a.userId, "approved")}
            >
              {busyId === a.userId ? "…" : "Approve"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busyId !== null}
              onClick={() => decide(a.userId, "rejected")}
            >
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
