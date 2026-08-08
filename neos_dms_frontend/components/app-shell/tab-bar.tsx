"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SquareX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTabs } from "@/components/app-shell/tabs-provider";

/**
 * Closable page tabs, rendered inline in the top bar (between the module
 * title and the search/account actions). Overflowing tabs scroll
 * horizontally inside a frosted-glass rail (native scrollbar hidden), with
 * edge fades that appear only when there's more to scroll. The active tab
 * scrolls itself into view and carries full keyboard support (arrow keys,
 * Home/End, Delete to close). A close-all action sits at the end of the rail.
 */
export function TabBar() {
  const router = useRouter();
  const { tabs, activeHref, closeTab, closeAllTabs } = useTabs();
  const railRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });

  const activeIndex = tabs.findIndex((t) => t.href === activeHref);

  const updateEdges = React.useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  React.useEffect(() => {
    updateEdges();
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    el.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateEdges);
    };
  }, [updateEdges, tabs.length]);

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeHref]);

  const focusTabAt = (index: number) => {
    const wrap = (index + tabs.length) % tabs.length;
    const el = railRef.current?.querySelectorAll<HTMLButtonElement>(
      "[data-tab-trigger]",
    )[wrap];
    el?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusTabAt(index + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusTabAt(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusTabAt(0);
        break;
      case "End":
        e.preventDefault();
        focusTabAt(tabs.length - 1);
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        closeTab(tabs[index].href);
        break;
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <div className="relative min-w-0 flex-1">
        <div
          ref={railRef}
          className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-border/60 bg-background/60 px-1 py-1 shadow-sm backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Open pages"
          aria-orientation="horizontal"
        >
          {tabs.map((tab, index) => {
            const active = tab.href === activeHref;
            const isFocusable =
              activeIndex === -1 ? index === 0 : active;

            return (
              <div
                key={tab.id}
                ref={active ? activeRef : undefined}
                role="tab"
                aria-selected={active}
                className={cn(
                  "group/tab relative flex h-7 shrink-0 items-center overflow-hidden rounded-md text-sm transition-colors duration-150",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                )}
              >
                <button
                  type="button"
                  data-tab-trigger
                  tabIndex={isFocusable ? 0 : -1}
                  onClick={() => router.push(tab.href)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      closeTab(tab.href);
                    }
                  }}
                  title={tab.href}
                  className="max-w-48 truncate py-1 pl-2.5 pr-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                >
                  {tab.label}
                </button>
                <button
                  type="button"
                  onClick={() => closeTab(tab.href)}
                  aria-label={`Close ${tab.label}`}
                  title="Close tab"
                  tabIndex={-1}
                  className={cn(
                    "mr-1 flex size-4 shrink-0 items-center justify-center rounded-sm transition-all duration-150",
                    active
                      ? "text-primary-foreground/70 opacity-100 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                      : "opacity-0 text-muted-foreground hover:bg-foreground/10 hover:text-foreground group-hover/tab:opacity-100 group-focus-within/tab:opacity-100",
                  )}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>

        {/* Edge fades — only visible when there's more to scroll in that direction */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-lg bg-gradient-to-r from-background/80 to-transparent transition-opacity duration-150",
            edges.left ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-lg bg-gradient-to-l from-background/80 to-transparent transition-opacity duration-150",
            edges.right ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <button
        type="button"
        onClick={closeAllTabs}
        aria-label="Close all tabs"
        title="Close all tabs"
        className="flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
      >
        <SquareX className="size-4" aria-hidden />
      </button>
    </div>
  );
}