import { AppShell } from "@/components/app-shell/app-shell";

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell scope="org">{children}</AppShell>;
}
