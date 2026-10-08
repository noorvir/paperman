import { useHydrated, useLoaderData } from "@tanstack/react-router";

export function LocalTime({
  value,
  dateOnly = false,
}: {
  value: string | null;
  dateOnly?: boolean;
}) {
  const hydrated = useHydrated();
  const timeFormat = useLoaderData({
    from: "__root__",
    select: (settings) => settings.time_format,
  });
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
    options.hourCycle = timeFormat === "12h" ? "h12" : "h23";
  }
  return (
    <time dateTime={value} aria-busy={!hydrated}>
      {hydrated
        ? new Intl.DateTimeFormat(undefined, options).format(new Date(value))
        : "\u00a0"}
    </time>
  );
}
