"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import {
  getAuthorizedModules,
  type AppScope,
} from "@/lib/modules/registry";

export function AppShell({
  scope,
  children,
}: {
  scope: AppScope;
  children: React.ReactNode;
}) {
  const { permissions } = useAuth();
  const modules = getAuthorizedModules(scope, permissions);

  return (
    <RequireAuth scope={scope}>
      <div className="flex min-h-dvh bg-muted/40">
        <Sidebar modules={modules} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar scope={scope} modules={modules} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
