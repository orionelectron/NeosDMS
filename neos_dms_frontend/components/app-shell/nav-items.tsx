"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ModuleConfig } from "@/lib/modules/registry";

export function NavItems({
  modules,
  onNavigate,
}: {
  modules: ModuleConfig[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {modules.map((module) => {
        const active =
          pathname === module.href ||
          pathname.startsWith(`${module.href}/`);
        const Icon = module.icon;
        return (
          <Link
            key={module.key}
            href={module.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={module.description}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {module.label}
          </Link>
        );
      })}
    </nav>
  );
}
