import { useRef } from "react";
import { useBlocker } from "@tanstack/react-router";

export function useUnsavedChanges(
  snapshot: string,
  viewParams: readonly string[] = [],
) {
  const saved = useRef(snapshot);
  const current = useRef(snapshot);
  current.current = snapshot;
  const blocker = useBlocker({
    shouldBlockFn: ({ current: location, next }) => {
      const search: Record<string, unknown> = location.search;
      const nextSearch: Record<string, unknown> = next.search;
      const keys = new Set([
        ...Object.keys(search),
        ...Object.keys(nextSearch),
      ]);
      const sameDraft =
        location.pathname === next.pathname &&
        [...keys].every(
          (key) =>
            viewParams.includes(key) ||
            JSON.stringify(search[key]) === JSON.stringify(nextSearch[key]),
        );
      if (sameDraft) {
        return false;
      }
      return current.current !== saved.current;
    },
    enableBeforeUnload: () => current.current !== saved.current,
    withResolver: true,
  });
  return {
    blocker,
    isDirty: snapshot !== saved.current,
    markSaved: () => {
      saved.current = snapshot;
    },
  };
}
