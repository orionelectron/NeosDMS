import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { cn } from "@/lib/utils";

/**
 * Common page scaffold used by every CRUD/management page so headers and
 * spacing stay consistent. Pairs the (icon + title + description + actions)
 * header with the page content. The page fills the viewport height: the header
 * stays fixed and the content region scrolls independently, letting table
 * pages anchor their pagination at the bottom.
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
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        actions={actions}
        className="shrink-0"
      />
      <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
