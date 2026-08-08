import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Plan } from "@/lib/api/plans";
import {
  BILLING_PERIODS,
  getPlanPrice,
  type BillingPeriod,
} from "@/lib/plans";
import { formatMoney } from "@/lib/format";

export function PlanSelect({
  plans,
  value,
  onChange,
  period,
  onPeriodChange,
}: {
  plans: Plan[];
  value: string;
  onChange: (planCode: string) => void;
  period: BillingPeriod;
  onPeriodChange: (period: BillingPeriod) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {BILLING_PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onPeriodChange(option)}
            aria-pressed={period === option}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              period === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => {
          const price = getPlanPrice(plan, period);
          const selected = value === plan.code;
          const featured = plan.code === "growth";
          return (
            <button
              key={plan.code}
              type="button"
              onClick={() => onChange(plan.code)}
              aria-pressed={selected}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-4 text-left transition-colors",
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              {featured && (
                <Badge className="absolute -top-2.5 right-3 text-[10px]">
                  Popular
                </Badge>
              )}
              <span className="font-semibold">{plan.name}</span>
              <span className="mt-2 text-2xl font-semibold tracking-tight tnum">
                {price ? formatMoney(price.basePrice) : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                / {period.toLowerCase()} ·{" "}
                {formatLimit(plan.limits.users)} users
              </span>
              <span className="mt-2 text-xs text-muted-foreground">
                {formatLimit(plan.limits.invoices_per_month)} invoices / month
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatLimit(value: number): string {
  return value === -1 ? "Unlimited" : String(value);
}
