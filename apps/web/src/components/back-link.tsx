import type { ComponentProps } from "react";
import { createLink } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "./ui/button";
import { cn } from "cn";

export const BackLink = createLink(BackAnchor);

function BackAnchor({ className, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={cn(
        buttonVariants({
          variant: "outline",
          size: "icon",
          className,
        }),
      )}
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
    </a>
  );
}
