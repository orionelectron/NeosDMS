"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTabs } from "@/components/app-shell/tabs-provider";

/**
 * Closable page tabs, rendered inline in the top bar (between the module
 * title and the search/account actions). Overflowing tabs scroll horizontally
 * (native scrollbar); the active tab scrolls itself into view.
 */
export function TabBar() {
  const router = useRouter();
  const { tabs, activeHref, closeTab } = useTabs();
  const activeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeHref]);

  if (tabs.length === 0) return null;

  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
      role="tablist"
      aria-label="Open pages"
    >
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <div
            key={tab.id}
            ref={active ? activeRef : undefined}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex h-7 shrink-0 items-center overflow-hidden rounded-md border text-sm transition-colors",
              active
                ? "border-border bg-background text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <button
              type="button"
              onClick={() => router.push(tab.href)}
              title={tab.href}
              className="max-w-52 truncate px-2.5 py-1"
            >
              {tab.label}
            </button>
            <button
              type="button"
              onClick={() => closeTab(tab.href)}
              aria-label={`Close ${tab.label}`}
              title="Close tab"
              className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
