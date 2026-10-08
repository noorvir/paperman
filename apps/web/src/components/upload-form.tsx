import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { useRef, useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Upload04Icon,
  File01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorNotice } from "./page";

export function UploadForm() {
  const [pending, setPending] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const unsaved = useUnsavedChanges(
    !scanId && file ? `${file.name}:${file.size}:${file.lastModified}` : "",
  );
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending) {
      return;
    }
    setPending(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body });
      const result: unknown = await response.json();
      if (!response.ok) {
        const error = z.object({ detail: z.string() }).safeParse(result);
        throw new Error(
          error.success
            ? error.data.detail
            : "Upload failed. Use a PDF within the upload limit and try again.",
        );
      }
      const scan = z.object({ id: z.string().min(1) }).parse(result);
      setScanId(scan.id);
      await router.invalidate();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }
  if (scanId)
    return (
      <section
        className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-16 text-center"
        role="status"
      >
        <span className="rounded-full bg-success p-3 text-success-foreground">
          <HugeiconsIcon icon={Tick02Icon} size={24} />
        </span>
        <h2 className="text-lg font-semibold">Scan received</h2>
        <p className="workspace-description">
          {file?.name} is saved. Open the scan to see its processing status and
          review its documents.
        </p>
        <Link
          to="/scans/$scanId"
          params={{ scanId }}
          search={{ preview: false, view: "pdf" }}
          className={buttonVariants()}
        >
          View progress
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            setScanId(null);
            setFile(null);
          }}
        >
          Upload another scan
        </Button>
      </section>
    );
  return (
    <form
      className="mx-auto flex w-full max-w-xl flex-col gap-5 py-6"
      onSubmit={(event) => void upload(event)}
    >
      <UnsavedChangesDialog blocker={unsaved.blocker} />
      <div
        className={`flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-14 text-center transition-colors ${dragging ? "border-foreground bg-muted" : "bg-muted/30"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          setFile(event.dataTransfer.files.item(0));
        }}
      >
        <span className="rounded-lg bg-background p-3 ring-1 ring-border">
          <HugeiconsIcon
            icon={file ? File01Icon : Upload04Icon}
            size={24}
            className="text-muted-foreground"
          />
        </span>
        <div>
          <h2 className="text-sm font-medium">
            {file ? file.name : "Drop your PDF here"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB · Ready to upload`
              : "A single letter or a whole batch of mail."}
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          aria-label="PDF scan"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.item(0) ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => input.current?.click()}
        >
          {file ? "Choose another file" : "Browse files"}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        The original scan is preserved. You can review document groups, owners,
        and titles before they are filed.
      </p>
      <ErrorNotice message={error} />
      <div className="flex justify-end gap-2">
        <Link
          to="/scans"
          search={{}}
          className={buttonVariants({ variant: "ghost" })}
        >
          Cancel
        </Link>
        <Button type="submit" loading={pending} disabled={!file || pending}>
          Upload scan
        </Button>
      </div>
    </form>
  );
}
