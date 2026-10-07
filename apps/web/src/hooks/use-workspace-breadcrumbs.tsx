import { Link, useMatch } from "@tanstack/react-router";
import { documentSearch, scanSearch } from "@/lib/queries";

export function useWorkspaceBreadcrumbs() {
  const documents = useMatch({ from: "/documents", shouldThrow: false });
  const document = useMatch({
    from: "/documents/$documentId",
    shouldThrow: false,
  });
  const scans = useMatch({ from: "/scans", shouldThrow: false });
  const scan = useMatch({ from: "/scans/$scanId", shouldThrow: false });
  const review = useMatch({
    from: "/scans_/$scanId/review",
    shouldThrow: false,
  });
  const upload = useMatch({ from: "/scans_/upload", shouldThrow: false });

  if (documents) {
    const breadcrumbs = [
      {
        id: "documents",
        label: "Documents",
        link: (
          <Link
            to="/documents"
            search={documentSearch.parse(documents.search)}
            resetScroll={false}
          />
        ),
      },
    ];
    if (document?.loaderData) {
      const { id, title } = document.loaderData.document;
      breadcrumbs.push({
        id,
        label: title,
        link: (
          <Link
            to="/documents/$documentId"
            params={{ documentId: id }}
            search={{
              ...document.search,
              edit: false,
            }}
            resetScroll={false}
          />
        ),
      });
      if (document.search.edit) {
        breadcrumbs.push({
          id: "edit",
          label: "Edit",
          link: (
            <Link
              to="/documents/$documentId"
              params={{ documentId: id }}
              search={document.search}
              resetScroll={false}
            />
          ),
        });
      }
    }
    return breadcrumbs;
  }

  if (scans || review || upload) {
    const breadcrumbs = [
      {
        id: "scans",
        label: "Scans",
        link: (
          <Link
            to="/scans"
            search={scanSearch.parse(scans?.search ?? {})}
            resetScroll={false}
          />
        ),
      },
    ];
    const selected = scan?.loaderData?.scan ?? review?.loaderData?.scan;
    if (selected) {
      breadcrumbs.push({
        id: selected.id,
        label: selected.original_name,
        link: (
          <Link
            to="/scans/$scanId"
            params={{ scanId: selected.id }}
            search={scan?.search ?? {}}
            resetScroll={false}
          />
        ),
      });
      if (review) {
        breadcrumbs.push({
          id: "review",
          label: selected.status === "complete" ? "Edit" : "Review",
          link: (
            <Link to="/scans/$scanId/review" params={{ scanId: selected.id }} />
          ),
        });
      }
    }
    if (upload) {
      breadcrumbs.push({
        id: "upload",
        label: "Upload a scan",
        link: <Link to="/scans/upload" />,
      });
    }
    return breadcrumbs;
  }

  return [];
}
