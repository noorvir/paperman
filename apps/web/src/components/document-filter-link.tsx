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
  ...props
}: Omit<ComponentProps<"a">, "href"> & {
  search: z.output<typeof documentSearch>;
  filter: Partial<
    Pick<
      z.output<typeof documentSearch>,
      "owner" | "tag" | "after" | "before" | "status"
    >
  >;
}) {
  return (
    <Link
      {...props}
      to="/documents"
      search={documentSearch.parse({ ...search, ...filter, page: 1 })}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "relative justify-start gap-2 px-1 font-normal",
        className,
      )}
    />
  );
}
