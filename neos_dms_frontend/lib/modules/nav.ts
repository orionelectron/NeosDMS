import type { ModuleConfig } from "@/lib/modules/registry";

export interface NavTarget {
  href: string;
  label: string;
}

/** Flatten module hubs + child pages into a href → label lookup source. */
export function flattenNavTargets(modules: ModuleConfig[]): NavTarget[] {
  const targets: NavTarget[] = [];
  for (const mod of modules) {
    targets.push({ href: mod.href, label: mod.label });
    for (const child of mod.children ?? []) {
      targets.push({ href: child.href, label: child.label });
    }
  }
  return targets;
}

/**
 * Human label for a route, used for tabs and breadcrumbs. Exact nav match
 * wins; otherwise the deepest nav prefix (so `/inventory/transactions/abc`
 * reads as "Movements"); finally the last URL segment, prettified.
 */
export function getTabLabel(modules: ModuleConfig[], pathname: string): string {
  const targets = flattenNavTargets(modules);
  const exact = targets.find((target) => target.href === pathname);
  if (exact) return exact.label;

  const prefix = targets
    .filter((target) => pathname.startsWith(`${target.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (prefix) return prefix.label;

  const segment = pathname.split("/").filter(Boolean).pop() ?? "Page";
  return (
    segment.charAt(0).toUpperCase() +
    segment.slice(1).replace(/[-_]/g, " ")
  );
}
