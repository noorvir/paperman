import { useRef, type ComponentProps, type ReactNode } from "react";
import { createLink } from "@tanstack/react-router";
import { Dialog } from "@base-ui/react/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, FullScreenIcon } from "@hugeicons/core-free-icons";
import { PageHeader } from "./page";
import { Button } from "./ui/button";
import { PreviewAction } from "./preview-action";

export function CollectionPreview({
  id,
  title,
  description,
  badge,
  preview,
  back,
  openLink,
  primaryAction,
  actions,
  navigation,
  onClose,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  badge?: ReactNode;
  preview: boolean;
  back: ReactNode;
  openLink: ReactNode;
  primaryAction?: ReactNode;
  actions?: ReactNode;
  navigation?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const heading = (
    <div
      className="flex shrink-0 flex-col gap-3 data-[navigation=false]:border-b data-[navigation=false]:pb-3"
      data-slot="collection-header"
      data-navigation={Boolean(navigation)}
    >
      <PageHeader
        title={title}
        description={description}
        badge={badge}
        back={!preview && back}
      >
        {primaryAction}
        {preview && openLink}
        {actions}
        {preview && (
          <Dialog.Close
            render={<Button variant="ghost" size="icon" />}
            aria-label="Close preview"
            title="Close preview"
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </Dialog.Close>
        )}
      </PageHeader>
      {navigation}
    </div>
  );
  if (!preview) {
    return (
      <section
        className="collection-preview"
        data-preview={false}
        aria-label={title}
      >
        {heading}
        {children}
      </section>
    );
  }
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
            {heading}
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
    <PreviewAction
      render={(buttonProps) => <a {...props} {...buttonProps} />}
      nativeButton={false}
      icon={FullScreenIcon}
      title="Open full view"
      aria-label="Open full view"
    >
      Open
    </PreviewAction>
  );
});
