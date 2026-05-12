import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarUploadForm } from "@/components/avatar/avatar-upload-form";
import { CsrfField } from "@/components/csrf-field";
import { signOutAction } from "@/app/login/actions";
import { requireAuth } from "@/lib/auth";
import { getOwnProfile } from "@/lib/profile";
import { EditProfileForm } from "../edit-profile-form";

export default async function ProfileSettingsPage() {
  const session = await requireAuth();
  const profile = await getOwnProfile(session.user.id);
  const name = profile?.name ?? session.user.name;
  const bio = profile?.bio ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Your avatar, name, and bio are visible to other members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <AvatarUploadForm
            endpoint="/api/users/me/avatar"
            hasImage={Boolean(session.user.image)}
            label="Profile avatar"
          />
          <EditProfileForm name={name} bio={bio} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Read-only account information from your current session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{session.user.email}</dd>
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="font-mono text-xs">{session.user.id}</dd>
          </dl>
          <form action={signOutAction}>
            <CsrfField />
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
