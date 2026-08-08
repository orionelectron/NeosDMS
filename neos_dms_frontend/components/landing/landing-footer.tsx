import Link from "next/link";
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
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <Brand subtitle="Distribution management" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The operating system for FMCG distributors in Nepal — orders,
              inventory, dispatch and IRD/CBMS-ready accounting, built to run
              offline in the field.
            </p>
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
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} NEOS DMS. All rights reserved.</p>
          <p>Built in Kathmandu, Nepal · AD &amp; Bikram Sambat dates</p>
        </div>
      </div>
    </footer>
  );
}
