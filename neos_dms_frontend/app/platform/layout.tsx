import { AppShell } from "@/components/app-shell/app-shell";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell scope="platform">{children}</AppShell>;
}
