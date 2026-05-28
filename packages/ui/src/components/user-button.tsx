import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@lite/ui/components/avatar";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@lite/ui/lib/utils";

const iconvVariants = cva("border flex items-center justify-center", {
  variants: {
    size: {
      default: "size-10 min-w-10",
      sm: "size-8 min-w-8",
      lg: "size-10 min-w-10",
      xs: "size-6 min-w-6",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

interface UserButtonProps extends VariantProps<typeof iconvVariants> {
  className?: string;
  url?: string | null;
  name?: string | null;
  fallbackClassName?: string;
}

const UserButton = ({
  className,
  url,
  name = "User",
  size,
  fallbackClassName,
}: UserButtonProps) => {
  const twoLettersName = name
    ? name
        .split(/[-\s]/)
        .filter(Boolean)
        .map((l) => l[0])
        .join("")
        .slice(0, 2)
    : "U";

  return (
    <Avatar className={cn(iconvVariants({ size, className }))}>
      <AvatarImage src={url as string} />
      <AvatarFallback
        className={cn("text-sm font-semibold uppercase", fallbackClassName)}
      >
        {twoLettersName}
      </AvatarFallback>
    </Avatar>
  );
};

export { iconvVariants, UserButton };
