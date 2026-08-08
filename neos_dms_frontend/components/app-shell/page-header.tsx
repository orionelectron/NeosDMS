import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/60 shadow-sm backdrop-blur-md",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"
      />
      <div className="relative flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10">
              <Icon className="size-[18px]" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="max-w-2xl truncate text-[13px] text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
