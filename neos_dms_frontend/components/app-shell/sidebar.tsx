"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ModuleConfig } from "@/lib/modules/registry";
import { Brand } from "@/components/app-shell/brand";
import { NavItems } from "@/components/app-shell/nav-items";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "neos:sidebar-collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar({ modules }: { modules: ModuleConfig[] }) {
  const [collapsed, setCollapsed] = React.useState(readCollapsed);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      void 0;
    }
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-gradient-to-b from-card via-card to-card/90 transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <Brand collapsed={collapsed} />
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed && "hidden",
          )}
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="size-4" aria-hidden />
        </Button>
      </div>
      <div
        className={cn(
          "flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]",
          collapsed ? "px-2 py-4" : "px-3 py-4",
        )}
      >
        <NavItems
          modules={modules}
          collapsed={collapsed}
          onExpand={() => setCollapsed(false)}
        />
      </div>
      {collapsed && (
        <div className="flex justify-center border-t border-border py-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </aside>
  );
}
