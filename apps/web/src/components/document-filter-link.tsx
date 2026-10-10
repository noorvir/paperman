import type { ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import type { z } from "zod";
import type { documentSearch } from "@/lib/queries";
import { buttonVariants } from "./ui/button";

export function DocumentFilterLink({
  search,
  filter,
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: Omit<ComponentProps<"a">, "href"> & {
  search: Partial<z.output<typeof documentSearch>>;
  size?: "sm" | "xs";
  variant?: "ghost" | "secondary";
  filter: Partial<
    Pick<
      z.output<typeof documentSearch>,
      "creator" | "owner" | "tag" | "after" | "before" | "status"
    >
  >;
}) {
  const next = { ...search, ...filter, page: 1 };
  if (filter.owner) {
    next.owner = [...(search.owner ?? []), ...filter.owner];
  }
  if (filter.creator) {
    next.creator = [...(search.creator ?? []), ...filter.creator];
  }
  if (filter.tag) {
    next.tag = [...(search.tag ?? []), ...filter.tag];
  }

  return (
    <Link
      {...props}
      to="/documents"
      search={next}
      className={cn(
        buttonVariants({ variant, size }),
        "relative justify-start font-normal",
        size === "sm" && "gap-2 px-1",
        className,
      )}
    />
  );
}
