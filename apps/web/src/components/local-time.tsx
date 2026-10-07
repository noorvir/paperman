import { useHydrated } from "@tanstack/react-router";

export function LocalTime({
  value,
  dateOnly = false,
}: {
  value: string | null;
  dateOnly?: boolean;
}) {
  const hydrated = useHydrated();
  if (!value) {
    return <span>-</span>;
  }
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  if (!dateOnly) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return (
    <time dateTime={value} aria-busy={!hydrated}>
      {hydrated
        ? new Intl.DateTimeFormat(undefined, options).format(new Date(value))
        : "\u00a0"}
    </time>
  );
}
