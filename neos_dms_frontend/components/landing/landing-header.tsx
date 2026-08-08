// components/landing/landing-header.tsx
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/app-shell/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";

export function LandingHeader() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="sticky top-0 z-40">
      <div className="border-b border-border/60 bg-primary text-primary-foreground">
        <div className="mx-auto flex h-8 w-full max-w-6xl items-center justify-center gap-1.5 px-4 text-xs font-medium sm:px-6">
          <ShieldCheck className="size-3.5" aria-hidden />
          IRD &amp; CBMS registered · Data hosted in Nepal · 3-day free trial, no card needed
        </div>
      </div>
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="NEOS DMS home">
            <Brand subtitle="Distribution management" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#trust" className="transition-colors hover:text-foreground">
              Security
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link href="/dashboard">Open app</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/onboarding">Start free trial</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}