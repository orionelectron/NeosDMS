import type { ModuleConfig } from "@/lib/modules/registry";
import { Brand } from "@/components/app-shell/brand";
import { NavItems } from "@/components/app-shell/nav-items";
import { UserMenu } from "@/components/app-shell/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export function Sidebar({ modules }: { modules: ModuleConfig[] }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <Brand />
        <ThemeToggle />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavItems modules={modules} />
      </div>
      <div className="border-t border-border p-2">
        <UserMenu />
      </div>
    </aside>
  );
}
