"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Scroll to the offerings table section after GET search / pagination (hash in URL). */
export function OfferingsSectionScroll() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start" });
    });
  }, [searchParams]);

  return null;
}
