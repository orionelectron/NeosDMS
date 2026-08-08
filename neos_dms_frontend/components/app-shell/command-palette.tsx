"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CornerDownLeft,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ModuleConfig } from "@/lib/modules/registry";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
}

interface CommandGroup {
  title: string;
  items: CommandItem[];
}

function buildGroups(modules: ModuleConfig[]): CommandGroup[] {
  const groups: CommandGroup[] = [];

  groups.push({
    title: "Go to",
    items: modules.flatMap((module) => {
      const children = (module.children ?? []).map((child) => ({
        id: `module:${module.key}:${child.key}`,
        label: child.label,
        description: module.label,
        href: child.href,
        icon: module.icon,
        keywords: [module.key, child.key],
      }));
      return [
        {
          id: `module:${module.key}`,
          label: module.label,
          description: module.description,
          href: module.href,
          icon: module.icon,
          keywords: [module.key],
        },
        ...children,
      ];
    }),
  });

  return groups;
}

function filterGroups(query: string, groups: CommandGroup[]): CommandGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;

  const scored: { group: CommandGroup; items: CommandItem[] }[] = [];
  for (const group of groups) {
    const matches: { item: CommandItem; score: number }[] = [];
    for (const item of group.items) {
      const haystack =
        `${item.label} ${item.description} ${item.keywords.join(" ")} ${group.title}`.toLowerCase();
      if (!haystack.includes(q)) continue;

      let score = 3;
      const label = item.label.toLowerCase();
      if (label === q) score = 0;
      else if (label.startsWith(q)) score = 1;
      else if (label.includes(q)) score = 2;
      matches.push({ item, score });
    }
    if (matches.length > 0) {
      matches.sort((a, b) => a.score - b.score);
      scored.push({ group, items: matches.map((match) => match.item) });
    }
  }
  return scored.map(({ group, items }) => ({ ...group, items }));
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function CommandPalette({
  modules,
  open,
  onOpenChange,
}: {
  modules: ModuleConfig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState(0);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  React.useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const groups = filterGroups(query, buildGroups(modules));
  const flat = groups.flatMap((group) => group.items);
  const flatIndex = new Map(flat.map((item, index) => [item.id, index]));

  function handleOpenChange(value: boolean) {
    if (!value) {
      setQuery("");
      setSelected(0);
    }
    onOpenChange(value);
  }

  function handleQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setSelected(0);
  }

  function navigate(index: number) {
    const item = flat[index];
    if (!item) return;
    handleOpenChange(false);
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((current) => (current + 1) % Math.max(1, flat.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((current) =>
        current <= 0 ? Math.max(0, flat.length - 1) : current - 1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      navigate(selected);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="top-[45%] gap-0 overflow-hidden p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search across navigation and jump to a page.
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages and actions…"
            className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-transparent"
            aria-label="Search"
          />
          <Kbd>esc</Kbd>
        </div>

        {flat.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
            <Search className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No results found</p>
            <p className="text-xs text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[24rem]">
            <div className="p-2">
              {groups.map((group) => (
                <div key={group.title} className="mb-1">
                  <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    const index = flatIndex.get(item.id) ?? -1;
                    const isSelected = index === selected;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setSelected(index)}
                        onClick={() => navigate(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isSelected && "bg-accent text-accent-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/60",
                            isSelected && "border-transparent",
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {item.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        {isSelected && (
                          <CornerDownLeft
                            className="size-4 shrink-0 opacity-60"
                            aria-hidden
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            {flat.length === 0 ? "No results" : `${flat.length} result${flat.length === 1 ? "" : "s"}`}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              <span className="ml-1">to open</span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
