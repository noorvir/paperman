import { Link } from "@tanstack/react-router";

export function SettingsNav({
  active,
}: {
  active: "processing" | "owners" | "tags";
}) {
  return (
    <nav aria-label="Settings sections" className="view-tabs">
      <Link to="/settings" data-active={active === "processing"}>
        Processing
      </Link>
      <Link
        to="/settings/$catalog"
        params={{ catalog: "owners" }}
        data-active={active === "owners"}
      >
        Owners
      </Link>
      <Link
        to="/settings/$catalog"
        params={{ catalog: "tags" }}
        data-active={active === "tags"}
      >
        Tags
      </Link>
    </nav>
  );
}
