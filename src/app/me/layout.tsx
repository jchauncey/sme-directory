import type { ReactNode } from "react";
import { ProfileSidebar } from "@/components/profile/profile-sidebar";

export default function MeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-[14rem_1fr] md:gap-8">
      <aside className="md:sticky md:top-4 md:self-start">
        <ProfileSidebar />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
