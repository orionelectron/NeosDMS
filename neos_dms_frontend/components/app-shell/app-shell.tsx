"use client";

import * as React from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import { TabsProvider } from "@/components/app-shell/tabs-provider";
import { CommandPalette } from "@/components/app-shell/command-palette";
import {
  getAuthorizedModules,
  resolveHomePath,
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
  const modules = React.useMemo(
    () => getAuthorizedModules(scope, permissions),
    [scope, permissions],
  );
  const homeHref = React.useMemo(
    () => resolveHomePath(scope, permissions),
    [scope, permissions],
  );
  const [commandOpen, setCommandOpen] = React.useState(false);

  return (
    <RequireAuth scope={scope}>
      <TabsProvider scope={scope} modules={modules} homeHref={homeHref}>
        <div className="flex h-dvh overflow-hidden bg-muted/40">
          <Sidebar modules={modules} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <TopBar
              modules={modules}
              onOpenCommand={() => setCommandOpen(true)}
            />
            <main className="mx-auto flex min-h-0 w-full max-w-[1700px] flex-1 flex-col px-4 pt-4 pb-4 sm:px-6">
              {children}
            </main>
          </div>
        </div>
        <CommandPalette
          modules={modules}
          open={commandOpen}
          onOpenChange={setCommandOpen}
        />
      </TabsProvider>
    </RequireAuth>
  );
}
