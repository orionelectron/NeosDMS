"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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
import { UserMenu } from "@/components/app-shell/user-menu";
import { Notifications } from "@/components/app-shell/notifications";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getModuleByPath,
  type AppScope,
  type ModuleConfig,
} from "@/lib/modules/registry";

export function TopBar({
  scope,
  modules,
}: {
  scope: AppScope;
  modules: ModuleConfig[];
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const currentModule = getModuleByPath(scope, pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6">
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

      <div className="hidden min-w-0 flex-col leading-tight lg:flex">
        <span className="truncate text-sm font-semibold">
          {currentModule?.label ?? "Workspace"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {currentModule?.description ?? "Distribution management"}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Notifications />
        <UserMenu compact />
      </div>
    </header>
  );
}
