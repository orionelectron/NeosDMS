import { cn } from "@/lib/utils";

export function Brand({
  subtitle,
  className,
  collapsed = false,
}: {
  subtitle?: string;
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        ND
      </span>
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">NEOS DMS</span>
          {subtitle && (
            <span className="text-[11px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
