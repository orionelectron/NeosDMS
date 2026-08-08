"use client";

import Link from "next/link";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plansApi } from "@/lib/api/plans";
import { queryKeys } from "@/lib/query/keys";
import {
  BILLING_PERIODS,
  DEFAULT_PERIOD,
  DEFAULT_PLANS,
  formatLimit,
  getPlanPrice,
  LIMIT_ROWS,
  type BillingPeriod,
} from "@/lib/plans";
import { formatMoney } from "@/lib/format";
import { SectionHeading } from "./section-heading";

export function LandingPricing() {
  const { data: plans = DEFAULT_PLANS } = useQuery({
    queryKey: queryKeys.plans.all,
    queryFn: plansApi.list,
    placeholderData: DEFAULT_PLANS,
    staleTime: 5 * 60 * 1000,
  });
  const [period, setPeriod] = React.useState<BillingPeriod>(DEFAULT_PERIOD);

  return (
    <section id="pricing" className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, predictable pricing"
          description="Every plan includes a 3-day grace period, unlimited branches on demand, and upgrades whenever you're ready."
        />

        <div className="mt-8 flex justify-center">
          <div
            className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm"
            role="group"
            aria-label="Billing period"
          >
            {BILLING_PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                aria-pressed={period === option}
                className={cn(
                  "relative rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  period === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
                {option === "Yearly" && (
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      period === option
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-success/10 text-success",
                    )}
                  >
                    Best value
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3 lg:gap-5">
          {plans.map((plan) => {
            const price = getPlanPrice(plan, period);
            const featured = plan.code === "growth";
            return (
              <div
                key={plan.code}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6 sm:p-7",
                  featured
                    ? "border-primary/60 shadow-[0_20px_50px_-24px_rgb(200_16_46/0.45)] ring-1 ring-primary/40 lg:-my-3 lg:py-9"
                    : "border-border shadow-sm",
                )}
              >
                {featured && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                    <Sparkles className="size-3" aria-hidden />
                    Most popular
                  </Badge>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums">
                    {price ? formatMoney(price.basePrice) : "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {period.toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Excl. VAT · billed {period.toLowerCase()}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 border-t border-border pt-6">
                  {LIMIT_ROWS.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      <Check
                        className="size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="text-muted-foreground">
                        {row.label}
                      </span>
                      <span className="ml-auto font-medium">
                        {formatLimit(Number(plan.limits[row.key]))}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2.5 text-sm">
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-muted-foreground">Multi-branch</span>
                    <span className="ml-auto font-medium">
                      {plan.limits.multi_branch ? "Yes" : "No"}
                    </span>
                  </li>
                </ul>
                <Button
                  asChild
                  size="lg"
                  className="mt-7 w-full"
                  variant={featured ? "default" : "outline"}
                >
                  <Link
                    href={`/onboarding?plan=${plan.code}&period=${period}`}
                  >
                    {featured ? "Start free trial" : "Choose plan"}
                  </Link>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  3-day grace period · no card needed
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
