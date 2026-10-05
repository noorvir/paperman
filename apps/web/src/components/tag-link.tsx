import type { ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import type { z } from "zod";
import type { components } from "@/lib/schema";
import type { documentSearch } from "@/lib/queries";
import { getTagIcon } from "@/lib/catalog-icons";
import { buttonVariants } from "./ui/button";

export function TagLink({
  tag,
  search,
  className,
  ...props
}: Omit<ComponentProps<"a">, "children" | "href"> & {
  tag: components["schemas"]["CatalogEntry"];
  search: z.output<typeof documentSearch>;
}) {
  return (
    <Link
      {...props}
      to="/documents"
      search={{ ...search, tag: tag.id, page: 1 }}
      aria-label={`Filter by ${tag.name}`}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "justify-start gap-2 px-1 font-normal",
        className,
      )}
    >
      <HugeiconsIcon
        icon={getTagIcon(tag)}
        size={16}
        className="size-4 text-muted-foreground"
        aria-hidden="true"
      />
      {tag.name}
    </Link>
  );
}
