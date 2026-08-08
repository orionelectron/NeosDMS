// components/landing/landing-hero.tsx
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Landmark,
  Radio,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";

function DashboardPreview() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_30%_20%,color-mix(in_srgb,var(--color-crimson-500)_16%,transparent),transparent),radial-gradient(50%_50%_at_80%_70%,color-mix(in_srgb,var(--color-flagblue-500)_14%,transparent),transparent)] blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-20px_rgb(28_24_21/0.25)] dark:shadow-[0_24px_60px_-16px_rgb(0_0_0/0.6)]">
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rust-400/80" />
            <span className="size-2.5 rounded-full bg-marigold-400/80" />
            <span className="size-2.5 rounded-full bg-success/80" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" aria-hidden />
            app.neosdms.com / dashboard
          </div>
          <span className="hidden items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary sm:flex">
            <Radio className="size-3" aria-hidden /> CBMS live
          </span>
        </div>

        <div className="grid sm:grid-cols-[10rem_1fr]">
          <aside className="hidden border-r border-border bg-muted/30 p-3 sm:block">
            {["Dashboard", "Orders", "Stock", "Dispatch", "Accounts"].map(
              (item, index) => (
                <div
                  key={item}
                  className={
                    index === 0
                      ? "tally-active mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium"
                      : "mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground"
                  }
                >
                  <span
                    className={
                      index === 0
                        ? "size-1.5 rounded-full bg-primary"
                        : "size-1.5 rounded-full bg-border"
                    }
                  />
                  {item}
                </div>
              ),
            )}
            <div className="mt-4 rounded-lg border border-border bg-card p-2.5">
              <p className="text-[10px] font-medium">This month</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Collection target
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[68%] rounded-full bg-primary" />
              </div>
              <p className="mt-1 text-[10px] font-medium tabular-nums">
                68% · Rs 8.4M
              </p>
            </div>
          </aside>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Today's sales", value: "Rs 1,42,500", tone: "text-primary" },
                { label: "Open orders", value: "38", tone: "text-accent" },
                { label: "Low stock", value: "12", tone: "text-marigold-600" },
                { label: "In transit", value: "6 loads", tone: "text-success" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <p className="text-[10px] text-muted-foreground">
                    {stat.label}
                  </p>
                  <p
                    className={`mt-0.5 text-sm font-semibold tabular-nums ${stat.tone}`}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Sales this quarter</p>
                <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                  +24.6%
                </span>
              </div>
              <svg viewBox="0 0 320 96" className="mt-3 h-24 w-full" aria-hidden>
                <defs>
                  <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-crimson-500)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--color-crimson-500)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[24, 48, 72].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="320"
                    y1={y}
                    y2={y}
                    className="stroke-border"
                    strokeWidth="1"
                    strokeDasharray="3 5"
                  />
                ))}
                <path
                  d="M0 78 C30 74 46 62 72 58 C102 53 118 68 148 52 C180 35 196 46 224 34 C254 21 280 26 320 10 L320 96 L0 96 Z"
                  fill="url(#hero-fill)"
                />
                <path
                  d="M0 78 C30 74 46 62 72 58 C102 53 118 68 148 52 C180 35 196 46 224 34 C254 21 280 26 320 10"
                  fill="none"
                  stroke="var(--color-crimson-500)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="320" cy="10" r="3.5" fill="var(--color-crimson-500)" />
              </svg>
            </div>

            <div className="grid grid-cols-[1fr_9rem] gap-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[10px] text-muted-foreground">
                  Recent invoices
                </p>
                <div className="mt-2 space-y-1.5">
                  {[
                    { no: "INV-1042", amount: "Rs 84,300", ok: true },
                    { no: "INV-1041", amount: "Rs 12,150", ok: true },
                    { no: "INV-1040", amount: "Rs 5,980", ok: false },
                  ].map((row) => (
                    <div key={row.no} className="flex items-center justify-between text-xs">
                      <span className="tabular-nums text-muted-foreground">
                        {row.no}
                      </span>
                      <span className="flex items-center gap-1.5 font-medium tabular-nums">
                        {row.amount}
                        <CheckCircle2
                          className={
                            row.ok ? "size-3.5 text-success" : "size-3.5 text-muted-foreground"
                          }
                          aria-hidden
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden flex-col justify-center gap-2.5 rounded-lg border border-border bg-card p-3 sm:flex">
                <span className="flex items-center gap-1.5 text-[10px] font-medium">
                  <ClipboardList className="size-3.5 text-primary" aria-hidden />
                  12 orders today
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-medium">
                  <Landmark className="size-3.5 text-accent" aria-hidden />
                  Posted &amp; balanced
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-medium">
                  <CalendarDays className="size-3.5 text-marigold-600" aria-hidden />
                  2083-04-22 BS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const EARLY_CUSTOMERS = [
  "Himal Distributors",
  "Everest FMCG Supply",
  "Kathmandu Trading Co.",
  "Sagarmatha Traders",
  "Bagmati Wholesale",
];

export function LandingHero() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-crimson-500)_14%,transparent),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden />
            IRD &amp; CBMS-compliant digital billing
          </Badge>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Distribution management built for{" "}
            <span className="bg-gradient-to-r from-primary via-crimson-500 to-accent bg-clip-text text-transparent">
              Nepal
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            NEOS DMS unifies orders, stock, dispatch and accounting in one
            offline-first app — with PAN/VAT billing, CBMS push tracking and
            Bikram Sambat dates that your field team can run on any device.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Open your workspace <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/onboarding">
                    Start free trial <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how">See how it works</a>
                </Button>
              </>
            )}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            3-day grace period on every plan · No credit card required
          </p>
        </div>

        <div className="mt-14 sm:mt-16">
          <DashboardPreview />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          {[
            { icon: WifiOff, label: "Offline-first, syncs later" },
            { icon: ShieldCheck, label: "PAN/VAT + CBMS push" },
            { icon: CalendarDays, label: "BS & AD dates" },
            { icon: Landmark, label: "Double-entry accounting" },
          ].map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <item.icon className="size-3.5 text-primary" aria-hidden />
              {item.label}
            </span>
          ))}
        </div>

        <div className="mt-16 border-t border-border pt-8">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Trusted by distributors across Nepal
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {EARLY_CUSTOMERS.map((name) => (
              <span
                key={name}
                className="text-sm font-semibold tracking-tight text-muted-foreground/70"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}