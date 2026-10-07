import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "./ui/button";

export function PreviewAction({
  icon,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
}) {
  return (
    <Button {...props} variant="outline">
      <HugeiconsIcon icon={icon} aria-hidden="true" />
      {children}
    </Button>
  );
}
