"use client";

import * as React from "react";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "@/components/app-shell/brand";
import { NavItems } from "@/components/app-shell/nav-items";
import { TabBar } from "@/components/app-shell/tab-bar";
import { UserMenu } from "@/components/app-shell/user-menu";
import { Notifications } from "@/components/app-shell/notifications";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ModuleConfig } from "@/lib/modules/registry";

function useIsMac(): boolean {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("resize", onStoreChange);
      return () => window.removeEventListener("resize", onStoreChange);
    },
    () => /mac/i.test(window.navigator.platform),
    () => false,
  );
}

export function TopBar({
  modules,
  onOpenCommand,
}: {
  modules: ModuleConfig[];
  onOpenCommand: () => void;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const isMac = useIsMac();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
            <SheetHeader className="h-14 justify-center border-b border-border px-4">
              <SheetTitle className="text-left">
                <Brand />
              </SheetTitle>
              <SheetDescription className="sr-only">
                Primary navigation
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavItems modules={modules} onNavigate={() => setSheetOpen(false)} />
            </div>
            <div className="border-t border-border p-2">
              <UserMenu />
            </div>
          </SheetContent>
        </Sheet>

        <span className="lg:hidden">
          <Brand />
        </span>

        <TabBar />

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            onClick={onOpenCommand}
            className="hidden h-9 w-52 items-center justify-start gap-2 rounded-md border-border bg-muted/40 px-3 text-sm font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground lg:flex"
            aria-label="Search and navigate"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="pointer-events-none inline-flex h-5 items-center rounded border border-border bg-background px-1.5 font-sans text-[10px] font-medium text-muted-foreground">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </Button>
          <ThemeToggle />
          <Notifications />
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}
