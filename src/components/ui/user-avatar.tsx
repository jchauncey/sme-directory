import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/initials";

type Props = {
  user: { name: string | null; email?: string | null; image: string | null };
  size?: "sm" | "default" | "lg";
  className?: string;
};

export function UserAvatar({ user, size = "default", className }: Props) {
  const initials = getInitials(user.name, user.email);
  return (
    <Avatar size={size} className={className}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
