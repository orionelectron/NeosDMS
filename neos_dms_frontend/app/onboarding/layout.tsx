import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/app-shell/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Create your workspace",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
        <Brand subtitle="Distribution management" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
