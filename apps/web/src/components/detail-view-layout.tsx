import type { ReactNode } from "react";

export function DetailViewLayout({
  children,
  sidebar,
  editor,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  editor?: ReactNode;
}) {
  return (
    <div
      className="detail-view-layout"
      data-sidebar={Boolean(sidebar)}
      data-editing={Boolean(editor)}
    >
      <section className="detail-primary">{children}</section>
      {editor ? (
        <section className="detail-editor" aria-label="Document editor">
          {editor}
        </section>
      ) : sidebar ? (
        <aside className="detail-sidebar">{sidebar}</aside>
      ) : null}
    </div>
  );
}
