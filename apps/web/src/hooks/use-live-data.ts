import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

export function useLiveData(enabled = true) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !router.state.isLoading) {
        void router.invalidate();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [router, enabled]);
}
