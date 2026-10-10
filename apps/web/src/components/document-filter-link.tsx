import type { ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import type { z } from "zod";
import { documentSearch } from "@/lib/queries";
import { buttonVariants } from "./ui/button";

export function DocumentFilterLink({
  search,
  filter,
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: Omit<ComponentProps<"a">, "href"> & {
  search: z.output<typeof documentSearch>;
  size?: "sm" | "xs";
  variant?: "ghost" | "secondary";
  filter: Partial<
    Pick<
      z.output<typeof documentSearch>,
      "creator" | "owner" | "tag" | "after" | "before" | "status"
    >
  >;
}) {
  return (
    <Link
      {...props}
      to="/documents"
      search={documentSearch.parse({
        ...search,
        ...filter,
        owner: [...search.owner, ...(filter.owner ?? [])],
        creator: [...search.creator, ...(filter.creator ?? [])],
        tag: [...search.tag, ...(filter.tag ?? [])],
        page: 1,
      })}
      className={cn(
        buttonVariants({ variant, size }),
        "relative justify-start font-normal",
        size === "sm" && "gap-2 px-1",
        className,
      )}
    />
  );
}
