// components/landing/landing-features.tsx
import {
  BarChart3,
  Boxes,
  ShieldCheck,
  Truck,
  Wallet,
  WifiOff,
} from "lucide-react";
import { SectionHeading } from "./section-heading";

const STATS = [
  { value: "40+", label: "distributors live" },
  { value: "99.9%", label: "uptime last 12mo" },
  { value: "<3s", label: "avg. CBMS push time" },
  { value: "24/7", label: "support via phone & chat" },
];

const features = [
  {
    icon: ShieldCheck,
    title: "IRD & CBMS billing",
    description:
      "PAN/VAT invoices, buyer snapshots and CBMS push tracking built into every sales document — ready for audit, not after it.",
    tint: "primary",
  },
  {
    icon: Boxes,
    title: "Inventory control",
    description:
      "Locations, balances, adjustments and transfers. Low-stock alerts surface before a stock-out reaches your best outlet.",
    tint: "accent",
  },
  {
    icon: Truck,
    title: "Dispatch & delivery",
    description:
      "Loadings, per-stop deliveries, PODs and failure reasons — from warehouse gate to the outlet shelf.",
    tint: "primary",
  },
  {
    icon: Wallet,
    title: "Accounting built in",
    description:
      "Fiscal years, journals, parties and taxes. Every transaction posts balanced entries automatically — VAT, TDS and all.",
    tint: "accent",
  },
  {
    icon: WifiOff,
    title: "Offline-first PWA",
    description:
      "Salesmen on the road keep working with no signal. Installs like an app, syncs when you're back online.",
    tint: "primary",
  },
  {
    icon: BarChart3,
    title: "Reports & analytics",
    description:
      "Sales, stock and accounting reports with Bikram Sambat dates throughout — the numbers your meetings actually need.",
    tint: "accent",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-t border-border bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="Why NEOS DMS"
          title="Everything a distributor needs, in one place"
          description="No more juggling notebooks, spreadsheets and separate billing software. One system from the warehouse to the outlet."
        />

        <dl className="mt-10 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-4 sm:p-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums tracking-tight text-primary sm:text-3xl">
                {stat.value}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </dl>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            const tinted =
              feature.tint === "accent"
                ? "bg-accent/10 text-accent"
                : "bg-primary/10 text-primary";
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  aria-hidden
                />
                <span className={`flex size-11 items-center justify-center rounded-lg ${tinted}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}