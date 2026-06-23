"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type NavProgressContextValue = {
  startNavigation: (href: string) => void;
  pendingHref: string | null;
};

const NavProgressContext = createContext<NavProgressContextValue | null>(null);

export function useNavProgress() {
  const ctx = useContext(NavProgressContext);
  if (!ctx) {
    return {
      startNavigation: () => {},
      pendingHref: null,
    };
  }
  return ctx;
}

/** Top-of-screen progress bar + shared pending href for sidebar links. */
export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [barVisible, setBarVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  const startNavigation = useCallback((href: string) => {
    setPendingHref(href);
    setBarVisible(true);
    setBarWidth(18);
  }, []);

  useEffect(() => {
    setPendingHref(null);
    setBarWidth(100);
    const hide = window.setTimeout(() => {
      setBarVisible(false);
      setBarWidth(0);
    }, 280);
    return () => window.clearTimeout(hide);
  }, [pathname]);

  useEffect(() => {
    if (!barVisible || barWidth >= 100) return;
    const tick = window.setInterval(() => {
      setBarWidth((w) => (w >= 92 ? w : w + 4));
    }, 120);
    return () => window.clearInterval(tick);
  }, [barVisible, barWidth]);

  return (
    <NavProgressContext.Provider value={{ startNavigation, pendingHref }}>
      {barVisible ? (
        <div
          className="fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-primary/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={barWidth}
          aria-label="Loading page"
        >
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      ) : null}
      {children}
    </NavProgressContext.Provider>
  );
}
