import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "./ui/button";

export function PreviewAction({
  icon,
  children,
  variant = "outline",
  ...props
}: Omit<ComponentProps<typeof Button>, "size" | "icon"> & {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
}) {
  return (
    <Button
      {...props}
      variant={variant}
      icon={<HugeiconsIcon icon={icon} aria-hidden="true" />}
    >
      {children}
    </Button>
  );
}
