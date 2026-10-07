import type { ComponentProps } from "react";
import { createLink } from "@tanstack/react-router";
import { cn } from "cn";
import { FileIcon } from "./file-icon";
import { buttonVariants } from "./ui/button";

export const FileLink = createLink(function FileAnchor({
  filename,
  title,
  children,
  className,
  ...props
}: ComponentProps<"a"> & { filename: string }) {
  return (
    <a
      {...props}
      title={title ?? filename}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "w-full justify-start gap-2 px-1",
        className,
      )}
    >
      <FileIcon filename={filename} />
      <span className="truncate font-medium">{children ?? filename}</span>
    </a>
  );
});
