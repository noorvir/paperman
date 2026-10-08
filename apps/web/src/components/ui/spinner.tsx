import { cn } from "cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      data-slot="spinner"
      aria-hidden="true"
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-full border-[1.5px] border-current border-t-transparent motion-safe:animate-spin",
        className,
      )}
    />
  );
}
