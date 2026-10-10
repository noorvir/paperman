import { useCallback } from "react";
import {
  defaultStringifySearch,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { pdfSearch } from "@/lib/search";

export function usePdfZoom() {
  const router = useRouter();
  const zoom = useSearch({
    strict: false,
    select: (search) => pdfSearch.parse(search).zoom,
  });
  const setZoom = useCallback(
    (value: string | number) => {
      const zoom = pdfSearch.shape.zoom.parse(
        typeof value === "string" && !Number.isNaN(Number(value))
          ? Number(value)
          : value,
      );
      const { pathname, search, hash } = router.latestLocation;
      void router.navigate({
        href: `${pathname}${defaultStringifySearch({ ...search, zoom })}${hash ? `#${hash}` : ""}`,
        replace: true,
        resetScroll: false,
      });
    },
    [router],
  );
  return { zoom, setZoom };
}
