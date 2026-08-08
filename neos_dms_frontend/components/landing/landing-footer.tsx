// components/landing/landing-footer.tsx
import Link from "next/link";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/app-shell/brand";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "How it works", href: "/#how" },
      { label: "Start free trial", href: "/onboarding" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Platform", href: "/platform/dashboard" },
      { label: "Design system", href: "/dev/design" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Brand subtitle="Distribution management" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The operating system for FMCG distributors in Nepal — orders,
              inventory, dispatch and IRD/CBMS-ready accounting, built to run
              offline in the field.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden />
              PAN 60XXXXXXX · Registered in Kathmandu, Nepal
            </div>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="text-sm font-semibold">Talk to us</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href="tel:+97700000000"
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="size-3.5" aria-hidden />
                  +977 0-0000000
                </a>
              </li>

              <li>
                <a
                  href="mailto:support@neosdms.com"
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mail className="size-3.5" aria-hidden />
                  support@neosdms.com
                </a>
              </li>

              <li className="pt-1 text-xs text-muted-foreground">
                Support hours: Sun–Fri, 9am–6pm NPT
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} NEOS DMS. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy policy
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms of service
            </Link>
            <span>Built in Kathmandu, Nepal · AD &amp; Bikram Sambat dates</span>
          </div>
        </div>
      </div>
    </footer>
  );
}