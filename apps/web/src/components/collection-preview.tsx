import { useRef, type ComponentProps, type ReactNode } from "react";
import { createLink } from "@tanstack/react-router";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "cn";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, FullScreenIcon } from "@hugeicons/core-free-icons";
import { PageHeader } from "./page";
import { Button, buttonVariants } from "./ui/button";

export function CollectionPreview({
  id,
  title,
  description,
  preview,
  back,
  openLink,
  actions,
  onClose,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  preview: boolean;
  back: ReactNode;
  openLink: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  return (
    <div ref={container} className="contents">
      <Dialog.Root
        open
        modal={false}
        disablePointerDismissal
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <Dialog.Portal container={container}>
          <Dialog.Popup
            className="collection-preview"
            data-preview={preview}
            aria-label={preview ? `Preview: ${title}` : title}
            initialFocus={false}
            finalFocus={() => document.getElementById(`collection-item-${id}`)}
          >
            <PageHeader
              title={title}
              description={description}
              back={!preview && back}
            >
              {actions}
              {preview && (
                <>
                  {openLink}
                  <Dialog.Close
                    render={<Button variant="ghost" size="icon" />}
                    aria-label="Close preview"
                    title="Close preview"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} />
                  </Dialog.Close>
                </>
              )}
            </PageHeader>
            {children}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export const OpenPreviewLink = createLink(function OpenPreviewAnchor({
  ...props
}: ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={cn(buttonVariants({ variant: "outline" }))}
      title="Open full view"
      aria-label="Open full view"
    >
      <HugeiconsIcon icon={FullScreenIcon} />
      Open
    </a>
  );
});
