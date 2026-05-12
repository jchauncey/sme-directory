import { cn } from "@/lib/utils";

type Props = {
  name: string;
  className?: string;
  "aria-hidden"?: boolean;
};

export function MaterialIcon({ name, className, "aria-hidden": ariaHidden = true }: Props) {
  return (
    <span
      className={cn(
        "material-symbols-outlined select-none text-[1.125rem] leading-none",
        className,
      )}
      aria-hidden={ariaHidden}
    >
      {name}
    </span>
  );
}
