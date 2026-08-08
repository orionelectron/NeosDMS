import Link from "next/link";
import {
  ArrowRight,
  Check,
  Languages,
  ShieldCheck,
  Star,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";

const TRUST_FEATURES = [
  { icon: ShieldCheck, label: "IRD & CBMS ready" },
  { icon: Languages, label: "Nepali + English" },
  { icon: WifiOff, label: "Works offline" },
];

const AVATARS = ["SK", "MB", "RP", "AT"];

export function LandingCta() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-crimson-600 via-crimson-700 to-crimson-900 px-6 py-14 text-center text-white shadow-[0_24px_60px_-24px_color-mix(in_srgb,var(--color-crimson-700)_50%,transparent)] ring-1 ring-white/10 sm:px-12 sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:40px_40px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -top-36 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.16),transparent)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-28 -bottom-28 size-80 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-flagblue-400)_45%,transparent),transparent)]"
            aria-hidden
          />

          <div
            className="pointer-events-none absolute top-16 left-8 hidden rotate-[-6deg] items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-sm lg:flex"
            aria-hidden
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="size-3" />
            </span>
            INV-1042 synced to CBMS
          </div>
          <div
            className="pointer-events-none absolute right-8 bottom-14 hidden rotate-[5deg] items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-sm lg:flex"
            aria-hidden
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-marigold-300 text-marigold-900">
              <Star className="size-3 fill-current" />
            </span>
            Route 3 payout settled
          </div>

          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
              <ShieldCheck className="size-3.5" aria-hidden />
              IRD &amp; CBMS-ready from day one
            </p>
            <h2 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to run your distribution on one system?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-white/80">
              Set up your workspace in minutes — organization, users and
              billing all at once. Your first 3 days are on us.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {isAuthenticated ? (
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="group shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Link href="/dashboard">
                    Open your workspace{" "}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="group shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Link href="/onboarding">
                      Create your workspace{" "}
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </Button>
                  <Link
                    href="/login"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-white/30 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:border-white/50 hover:bg-white/10"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-5 text-xs text-white/70">
              Free for the first 3 days · No credit card · Cancel anytime
            </p>

            <div className="mx-auto mt-10 flex max-w-md items-center gap-4">
              <span className="h-px flex-1 bg-white/15" aria-hidden />
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {AVATARS.map((initials) => (
                    <span
                      key={initials}
                      className="flex size-7 items-center justify-center rounded-full border border-white/20 bg-white/15 text-[10px] font-semibold text-white ring-2 ring-crimson-800"
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <p className="text-left text-xs text-white/70">
                  <span className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-3 fill-marigold-300 text-marigold-300"
                        aria-hidden
                      />
                    ))}
                  </span>
                  Trusted by{" "}
                  <span className="font-semibold text-white">40+ distributors</span>
                </p>
              </div>
              <span className="h-px flex-1 bg-white/15" aria-hidden />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {TRUST_FEATURES.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-xs text-white/75"
                >
                  <Icon className="size-3.5 text-white/60" aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
