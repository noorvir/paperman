import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon } from "@hugeicons/core-free-icons";

export function FileIcon({
  filename,
  size = "sm",
}: {
  filename: string;
  size?: "sm" | "lg";
}) {
  const pixels = size === "lg" ? 32 : 22;
  switch (filename.split(".").at(-1)?.toLowerCase()) {
    case "pdf":
      return (
        <img
          src="/icons/pdf.png"
          width={pixels}
          height={pixels}
          className="shrink-0 object-contain"
          alt=""
        />
      );
    default:
      return (
        <HugeiconsIcon
          icon={File01Icon}
          size={pixels}
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      );
  }
}
