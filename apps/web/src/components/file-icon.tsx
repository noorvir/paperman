import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon } from "@hugeicons/core-free-icons";

export function FileIcon({ filename }: { filename: string }) {
  switch (filename.split(".").at(-1)?.toLowerCase()) {
    case "pdf":
      return (
        <img
          src="/icons/pdf.png"
          width={22}
          height={22}
          className="size-[22px] shrink-0 object-contain"
          alt=""
        />
      );
    default:
      return (
        <HugeiconsIcon
          icon={File01Icon}
          size={22}
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      );
  }
}
