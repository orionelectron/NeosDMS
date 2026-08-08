"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { FullScreenLoader } from "@/components/auth/full-screen-loader";
import {
  getModuleByPath,
  isModuleAccessible,
  resolveHomePath,
  type AppScope,
} from "@/lib/modules/registry";

export function RequireAuth({
  scope,
  children,
}: {
  scope: AppScope;
  children: React.ReactNode;
}) {
  const { status, permissions } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const matchedModule = getModuleByPath(scope, pathname);
  const authorized = matchedModule
    ? isModuleAccessible(matchedModule, permissions)
    : true;

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (status === "authenticated" && matchedModule && !authorized) {
      router.replace(resolveHomePath(scope, permissions));
    }
  }, [status, pathname, matchedModule, authorized, router, scope, permissions]);

  if (status !== "authenticated") return <FullScreenLoader />;
  if (matchedModule && !authorized) return <FullScreenLoader />;
  return children;
}
