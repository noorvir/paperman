import type { components } from "@/lib/schema";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export function SourceAccessHelp({
  inbox,
}: {
  inbox: components["schemas"]["SourceReference"]["inbox"];
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="link" className="h-auto p-0" />}>
        Learn more
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why is source access restricted?</DialogTitle>
          <DialogDescription>
            {inbox === "shared"
              ? "This document came from the shared inbox. The original scan may contain other people’s documents."
              : "This document came from another person’s inbox. The original scan is private to that account."}
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>You can read this document without access to the full scan.</li>
          <li>
            {inbox === "shared"
              ? "Admins can view the full shared scan in admin mode."
              : "Sharing a document does not share its original scan."}
          </li>
          <li>Scans sent directly to your inbox are available to you.</li>
        </ul>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
