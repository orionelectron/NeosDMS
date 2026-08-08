"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ModuleConfig } from "@/lib/modules/registry";
import { getTabLabel } from "@/lib/modules/nav";

export interface NavTab {
  /** Unique id — the full route for that page. */
  id: string;
  href: string;
  label: string;
}

interface TabsContextValue {
  tabs: NavTab[];
  activeHref: string | null;
  closeTab: (href: string) => void;
  closeAllTabs: () => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function useTabs(): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabsProvider");
  }
  return context;
}

function readTabs(key: string): NavTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (tab): tab is NavTab =>
        Boolean(tab) &&
        typeof (tab as NavTab).id === "string" &&
        typeof (tab as NavTab).href === "string" &&
        typeof (tab as NavTab).label === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Client-side tab registry. Every page you land on becomes a tab (id = its
 * href) — the URL is the source of truth, so the tab is materialized during
 * render when navigation happens rather than in an effect. Closing an active
 * tab navigates to the neighbouring tab (or the module home when it was the
 * last one). Open tabs persist per scope in localStorage.
 */
export function TabsProvider({
  scope,
  modules,
  homeHref,
  children,
}: {
  scope: string;
  modules: ModuleConfig[];
  homeHref: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const storageKey = `neos:tabs:${scope}`;

  const [tabs, setTabs] = React.useState<NavTab[]>(() =>
    readTabs(storageKey),
  );
  const [seenPathname, setSeenPathname] = React.useState<string | null>(null);

  // Materialize a tab for every page we land on (adjust-state-during-render:
  // the pathname changes → re-render before commit with the tab present).
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    setTabs((current) =>
      current.some((tab) => tab.href === pathname)
        ? current
        : [
            ...current,
            {
              id: pathname,
              href: pathname,
              label: getTabLabel(modules, pathname),
            },
          ],
    );
  }

  // Persist open tabs.
  React.useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(tabs));
    } catch {
      void 0;
    }
  }, [tabs, storageKey]);

  const closeTab = React.useCallback(
    (href: string) => {
      setTabs((current) => current.filter((tab) => tab.href !== href));
      if (href !== pathname) return;
      const index = tabs.findIndex((tab) => tab.href === href);
      const remaining = tabs.filter((tab) => tab.href !== href);
      if (remaining.length > 0) {
        router.push(remaining[Math.max(0, index - 1)].href);
      } else {
        router.push(homeHref);
      }
    },
    [tabs, pathname, router, homeHref],
  );

  const closeAllTabs = React.useCallback(() => {
    setTabs([]);
    if (pathname !== homeHref) {
      router.push(homeHref);
    }
  }, [pathname, router, homeHref]);

  const value = React.useMemo(
    () => ({ tabs, activeHref: pathname, closeTab, closeAllTabs }),
    [tabs, pathname, closeTab, closeAllTabs],
  );

  return (
    <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
  );
}
