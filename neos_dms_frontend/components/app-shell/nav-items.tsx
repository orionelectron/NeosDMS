"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleConfig } from "@/lib/modules/registry";

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavItems({
  modules,
  onNavigate,
  collapsed = false,
  onExpand,
}: {
  modules: ModuleConfig[];
  onNavigate?: () => void;
  collapsed?: boolean;
  /** Called when a collapsed parent is clicked — expands the sidebar. */
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () =>
      new Set(
        modules
          .filter((mod) => mod.children?.length)
          .filter((mod) => isPathActive(pathname, mod.href))
          .map((mod) => mod.key),
      ),
  );

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const leafItem = (active: boolean) =>
    cn(
      "group/nav flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150",
      collapsed ? "w-full justify-center px-0 py-2" : "px-3 py-2",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <nav
      className={cn(
        "flex flex-col gap-1",
        collapsed && "items-center",
      )}
      aria-label="Primary"
    >
      {modules.map((mod) => {
        const Icon = mod.icon;
        const active = isPathActive(pathname, mod.href);
        const hasChildren = Boolean(mod.children?.length);
        // A group auto-opens while it holds the current page; manual toggles
        // (for other groups) are tracked in `expanded`.
        const open =
          !collapsed && hasChildren && (expanded.has(mod.key) || active);

        // Leaf: direct link.
        if (!hasChildren) {
          return (
            <Link
              key={mod.key}
              href={mod.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={
                collapsed
                  ? `${mod.label} · ${mod.description}`
                  : mod.description
              }
              className={leafItem(active)}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-transform duration-150 group-hover/nav:scale-110",
                  collapsed && "mx-auto",
                )}
                aria-hidden
              />
              {!collapsed && mod.label}
            </Link>
          );
        }

        // Collapsed parent: icon that re-expands the sidebar.
        if (collapsed) {
          return (
            <button
              key={mod.key}
              type="button"
              onClick={onExpand}
              aria-label={`Open ${mod.label}`}
              title={`${mod.label} · ${mod.description}`}
              className={cn(
                "flex w-full items-center justify-center rounded-lg py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
            </button>
          );
        }

        // Expanded parent: collapsible accordion with child links.
        return (
          <div key={mod.key} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggle(mod.key)}
              aria-expanded={open}
              title={mod.description}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">
                {mod.label}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                  open ? "rotate-0" : "-rotate-90",
                )}
                aria-hidden
              />
            </button>
            {open && (
              <div className="relative ml-[1.3rem] mt-1 flex flex-col gap-0.5 pl-4">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-px bg-border"
                />
                {mod.children!.map((child) => {
                  const childActive = isPathActive(pathname, child.href);
                  return (
                    <Link
                      key={child.key}
                      href={child.href}
                      onClick={onNavigate}
                      aria-current={childActive ? "page" : undefined}
                      className={cn(
                        "relative rounded-lg py-1.5 pl-3 pr-3 text-sm transition-colors",
                        childActive
                          ? "font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-150",
                          childActive ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
