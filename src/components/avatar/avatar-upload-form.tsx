"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

type Props = {
  endpoint: string;
  hasImage?: boolean;
  label?: string;
};

export function AvatarUploadForm({ endpoint, hasImage = false, label = "Avatar" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose an image first.");
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Image must be a PNG, JPEG, or WebP file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image is larger than 2 MB.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? data.error ?? `Upload failed (${res.status}).`);
        return;
      }
      toast.success("Avatar updated.");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove() {
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? data.error ?? `Remove failed (${res.status}).`);
        return;
      }
      toast.success("Avatar removed.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onUpload} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="avatar-file">
        {label}
      </label>
      <input
        ref={inputRef}
        id="avatar-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/70"
        disabled={submitting}
      />
      <Button type="submit" size="sm" disabled={submitting}>
        Upload
      </Button>
      {hasImage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={submitting}
          onClick={onRemove}
        >
          Remove
        </Button>
      ) : null}
    </form>
  );
}
