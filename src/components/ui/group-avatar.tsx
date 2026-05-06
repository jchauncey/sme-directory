import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/initials";

type Props = {
  group: { name: string; image: string | null };
  size?: "sm" | "default" | "lg";
  className?: string;
};

export function GroupAvatar({ group, size = "default", className }: Props) {
  const initials = getInitials(group.name);
  return (
    <Avatar size={size} className={className}>
      {group.image ? <AvatarImage src={group.image} alt="" /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
