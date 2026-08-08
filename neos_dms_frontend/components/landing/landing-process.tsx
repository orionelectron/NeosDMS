import { ClipboardList, Truck, Landmark } from "lucide-react";
import { SectionHeading } from "./section-heading";

const steps = [
  {
    icon: ClipboardList,
    title: "Salesmen capture orders",
    description:
      "Field teams take orders on any phone — with free-goods, discounts and the outlet's outstanding balance in front of them, even without signal.",
  },
  {
    icon: Truck,
    title: "Warehouse picks & dispatches",
    description:
      "Orders turn into loadings and per-stop deliveries. Stock is reserved, PODs captured and shortfalls auto-flagged for review.",
  },
  {
    icon: Landmark,
    title: "Accounts post & settle",
    description:
      "Every dispatch posts IRD-ready invoices and balanced journal entries automatically — VAT, TDS and CBMS push included.",
  },
];

export function LandingProcess() {
  return (
    <section id="how" className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="From order to cash in one flow"
          description="One record moves through sales, dispatch and accounting — nothing re-entered, nothing lost between systems."
        />
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative">
                {index < steps.length - 1 && (
                  <div
                    className="absolute left-6 top-6 hidden h-px w-[calc(100%-3rem)] translate-x-[3rem] border-t border-dashed border-border md:block"
                    aria-hidden
                  />
                )}
                <div className="flex items-center gap-3">
                  <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                    <Icon className="size-5 text-primary" aria-hidden />
                  </span>
                  <span className="text-4xl font-semibold tracking-tight text-muted-foreground/25">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
