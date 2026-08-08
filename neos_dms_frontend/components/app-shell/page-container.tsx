import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { cn } from "@/lib/utils";

/**
 * Common page scaffold used by every CRUD/management page so headers and
 * spacing stay consistent. Pairs the (icon + title + description + actions)
 * header with the page content, over an ambient glassmorphism backdrop.
 */
export function PageContainer({
  icon,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative space-y-6", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-16 h-64 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-3xl"
      />
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        actions={actions}
        className="relative"
      />
      <div className="relative space-y-6">{children}</div>
    </div>
  );
}
