import { useRef } from "react";
import { useBlocker } from "@tanstack/react-router";

export function useUnsavedChanges(snapshot: string) {
  const saved = useRef(snapshot);
  const current = useRef(snapshot);
  current.current = snapshot;
  const blocker = useBlocker({
    shouldBlockFn: () => current.current !== saved.current,
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
