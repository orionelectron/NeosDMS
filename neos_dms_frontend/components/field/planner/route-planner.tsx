"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  MapPinned,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/http";
import { routePlannerApi, type PlannerOutlet } from "@/lib/api/field";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import {
  clusterHue,
  clusterOutlets,
  pointInPolygon,
  type PlannedGroup,
} from "./clustering";

const PlannerMap = dynamic(
  () => import("./planner-map").then((mod) => mod.PlannerMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/40">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export function RoutePlanner() {
  const queryClient = useQueryClient();

  type OutletFilter = "all" | "unassigned";

  const [groups, setGroups] = React.useState<PlannedGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [selectedOutletId, setSelectedOutletId] = React.useState<string | null>(null);
  const [perRoute, setPerRoute] = React.useState(25);
  const [drawing, setDrawing] = React.useState(false);
  const [vertices, setVertices] = React.useState<Array<[number, number]>>([]);
  const [outletFilter, setOutletFilter] = React.useState<OutletFilter>("unassigned");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.field.routePlannerOutlets,
    queryFn: () => routePlannerApi.listOutlets(),
  });

  const feed = React.useMemo(() => data ?? [], [data]);

  const polygonActive = vertices.length >= 3;

  const inScope = React.useCallback(
    (outlet: PlannerOutlet) =>
      !polygonActive ||
      pointInPolygon(outlet.latitude, outlet.longitude, vertices),
    [polygonActive, vertices],
  );

  const byId = React.useMemo(
    () => new Map(feed.map((outlet) => [outlet.id, outlet])),
    [feed],
  );

  const pool = React.useMemo(() => {
    const plannedIds = new Set<string>();
    for (const group of groups) {
      for (const id of group.outletIds) plannedIds.add(id);
    }
    return feed.filter(
      (outlet) => outlet.routeId === null && !plannedIds.has(outlet.id),
    );
  }, [feed, groups]);

  const visiblePool = React.useMemo(
    () => pool.filter(inScope),
    [pool, inScope],
  );

  const unassignedTotal = React.useMemo(
    () => feed.filter((outlet) => outlet.routeId === null).length,
    [feed],
  );

  const unassignedInScope = React.useMemo(
    () => feed.filter((outlet) => outlet.routeId === null && inScope(outlet)).length,
    [feed, inScope],
  );

  const plannedCount = React.useMemo(
    () => groups.reduce((sum, group) => sum + group.outletIds.length, 0),
    [groups],
  );

  const plannedRouteCount = groups.filter((group) => group.outletIds.length > 0).length;

  const selectedOutlet = selectedOutletId
    ? (byId.get(selectedOutletId) ?? null)
    : null;
  const selectedOutletGroup =
    groups.find((group) => group.outletIds.includes(selectedOutletId ?? "")) ?? null;

  // -------------------------------------------------------------------------
  // Polygon drawing
  // -------------------------------------------------------------------------

  function toggleDrawing() {
    setDrawing((prev) => !prev);
  }

  function handleMapClick({ lat, lng }: { lat: number; lng: number }) {
    if (!drawing) return;
    setVertices((prev) => [...prev, [lat, lng]]);
  }

  function undoVertex() {
    setVertices((prev) => prev.slice(0, -1));
  }

  function finishPolygon() {
    if (vertices.length < 3) {
      toast.info("A polygon needs at least 3 points — keep clicking the map.");
      return;
    }
    setDrawing(false);
    setGroups([]);
    setSelectedGroupId(null);
    setSelectedOutletId(null);
    toast.success(
      `Polygon selected — ${unassignedInScope} unassigned outlet${unassignedInScope === 1 ? "" : "s"} inside.`,
    );
  }

  function clearPolygon() {
    setVertices([]);
    setDrawing(false);
  }

  // -------------------------------------------------------------------------
  // Plan actions
  // -------------------------------------------------------------------------

  function autoCluster() {
    const unrouted = feed.filter((outlet) => outlet.routeId === null && inScope(outlet));
    if (unrouted.length === 0) {
      toast.info("No unassigned outlets in scope to cluster.");
      return;
    }
    const next = clusterOutlets(unrouted, perRoute);
    setGroups(next);
    setSelectedGroupId(null);
    setSelectedOutletId(null);
    toast.success(
      `Planned ${next.length} route${next.length === 1 ? "" : "s"} across ${unrouted.length} outlet${unrouted.length === 1 ? "" : "s"}.`,
    );
  }

  function clearPlan() {
    setGroups([]);
    setSelectedGroupId(null);
    setSelectedOutletId(null);
  }

  function renameGroup(groupId: string, name: string) {
    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, name } : group)),
    );
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => prev.filter((group) => group.id !== groupId));
    if (selectedGroupId === groupId) setSelectedGroupId(null);
  }

  function assignOutlet(outletId: string, targetGroupId: string) {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        outletIds:
          group.id === targetGroupId
            ? group.outletIds.includes(outletId)
              ? group.outletIds
              : [...group.outletIds, outletId]
            : group.outletIds.filter((id) => id !== outletId),
      })),
    );
    setSelectedOutletId(null);
  }

  function removeFromGroup(outletId: string, groupId: string) {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, outletIds: group.outletIds.filter((id) => id !== outletId) }
          : group,
      ),
    );
    setSelectedOutletId(null);
  }

  function handlePointClick(id: string) {
    if (drawing) return;
    const outlet = byId.get(id);
    if (outlet?.routeId) {
      toast.warning(
        `${outlet.name} is already on a route — it can't be planned again.`,
      );
      return;
    }
    const group = groups.find((g) => g.outletIds.includes(id));
    setSelectedOutletId(id);
    if (group) setSelectedGroupId(group.id);
  }

  function handleSelectGroup(id: string | null) {
    setSelectedGroupId(id);
    setSelectedOutletId(null);
  }

  function handleFocusOutlet(outletId: string) {
    const group = groups.find((g) => g.outletIds.includes(outletId));
    setSelectedGroupId(group ? group.id : null);
    setSelectedOutletId(outletId);
  }

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: () =>
      routePlannerApi.createRoutes({
        dryRun: false,
        routes: groups
          .filter((group) => group.outletIds.length > 0)
          .map((group) => ({ name: group.name, outletIds: group.outletIds })),
      }),
    onSuccess: (report) => {
      const newRoutes = report.routes.filter((route) => route.created).length;
      if (report.linksSkipped > 0) {
        toast.warning(
          `Saved ${newRoutes} new route${newRoutes === 1 ? "" : "s"} — linked ${report.linksInserted} outlet${report.linksInserted === 1 ? "" : "s"}; ${report.linksSkipped} already on a route and skipped.`,
        );
      } else {
        toast.success(
          `Saved ${newRoutes} new route${newRoutes === 1 ? "" : "s"} and linked ${report.linksInserted} outlet${report.linksInserted === 1 ? "" : "s"}.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["field", "routes"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.field.routePlannerOutlets });
      clearPlan();
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "Could not save the plan."));
    },
  });

  const canSave = plannedRouteCount > 0 && !saveMutation.isPending;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isPending) {
    return (
      <div className="-my-6 -mx-4 h-[calc(100dvh-3.5rem)] min-h-[560px] sm:-mx-6 lg:-mx-8">
        <MapSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="-my-6 -mx-4 flex h-[calc(100dvh-3.5rem)] min-h-[560px] items-center justify-center sm:-mx-6 lg:-mx-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
              <MapPinned className="size-5 text-destructive" aria-hidden />
            </span>
            <p className="text-sm font-medium">Could not load outlets.</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {getErrorMessage(error, "Something went wrong.")}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="-my-6 -mx-4 flex h-[calc(100dvh-3.5rem)] min-h-[560px] items-center justify-center sm:-mx-6 lg:-mx-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <MapPinned className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <p className="text-sm font-medium">No outlets with coordinates.</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Add latitude/longitude to outlets (e.g. via the outlet import),
              then come back to plan routes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="-my-6 -mx-4 flex h-[calc(100dvh-3.5rem)] min-h-[560px] overflow-hidden sm:-mx-6 lg:-mx-8">
      <div className="relative min-w-0 flex-1">
        <PlannerMap
          outlets={feed}
          pool={visiblePool}
          groups={groups}
          selectedGroupId={selectedGroupId}
          selectedOutletId={selectedOutletId}
          drawing={drawing}
          vertices={vertices}
          showRouted={outletFilter === "all"}
          onPointClick={handlePointClick}
          onSelectGroup={handleSelectGroup}
          onMapClick={handleMapClick}
          onToggleDrawing={toggleDrawing}
          onUndoVertex={undoVertex}
          onFinishPolygon={finishPolygon}
          onClearPolygon={clearPolygon}
        />
      </div>

      <aside className="flex w-[21rem] shrink-0 flex-col gap-3 overflow-y-auto border-l bg-card/40 p-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Plan</CardTitle>
            <CardDescription>
              {plannedRouteCount} route{plannedRouteCount === 1 ? "" : "s"} ·{" "}
              {plannedCount} outlet{plannedCount === 1 ? "" : "s"} planned ·{" "}
              {unassignedTotal - plannedCount} unassigned
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div
              className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1"
              role="group"
              aria-label="Outlets on map"
            >
              <Button
                variant={outletFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setOutletFilter("all")}
                aria-pressed={outletFilter === "all"}
              >
                All outlets
              </Button>
              <Button
                variant={outletFilter === "unassigned" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setOutletFilter("unassigned")}
                aria-pressed={outletFilter === "unassigned"}
              >
                Unassigned
              </Button>
            </div>

            {polygonActive && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  Polygon scope: {unassignedInScope} of {unassignedTotal} unassigned
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground"
                  onClick={clearPolygon}
                  aria-label="Clear polygon scope"
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="per-route" className="text-xs">
                  Outlets per route
                </Label>
                <Input
                  id="per-route"
                  type="number"
                  min={1}
                  max={1000}
                  value={perRoute}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    setPerRoute(Number.isNaN(parsed) ? 1 : parsed);
                  }}
                  className="w-24"
                />
              </div>
              <Button
                onClick={autoCluster}
                disabled={unassignedInScope === 0 || saveMutation.isPending}
                className="flex-1"
              >
                <Sparkles className="size-4" aria-hidden />
                Auto-cluster
              </Button>
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canSave}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {saveMutation.isPending ? "Saving…" : "Save plan"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={clearPlan}
              disabled={groups.length === 0}
              className="w-full"
            >
              <RotateCcw className="size-4" aria-hidden />
              Clear plan
            </Button>
          </CardContent>
        </Card>

        <PlannedRoutesPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          byId={byId}
          onSelect={handleSelectGroup}
          onRename={renameGroup}
          onRemoveGroup={removeGroup}
          onAssign={assignOutlet}
          onRemoveOutlet={removeFromGroup}
          onFocusOutlet={handleFocusOutlet}
        />

        <SelectionPanel
          outlet={selectedOutlet}
          group={selectedOutletGroup}
          groups={groups}
          onAssign={assignOutlet}
          onRemove={removeFromGroup}
          onDeselect={() => setSelectedOutletId(null)}
        />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planned routes list
// ---------------------------------------------------------------------------

function PlannedRoutesPanel({
  groups,
  selectedGroupId,
  byId,
  onSelect,
  onRename,
  onRemoveGroup,
  onAssign,
  onRemoveOutlet,
  onFocusOutlet,
}: {
  groups: PlannedGroup[];
  selectedGroupId: string | null;
  byId: Map<string, PlannerOutlet>;
  onSelect: (id: string | null) => void;
  onRename: (groupId: string, name: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onAssign: (outletId: string, groupId: string) => void;
  onRemoveOutlet: (outletId: string, groupId: string) => void;
  onFocusOutlet: (outletId: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          No planned routes yet. Hit{" "}
          <span className="font-medium text-foreground">Auto-cluster</span> to
          group the unassigned outlets, or draw a polygon to narrow the scope.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Planned routes</CardTitle>
        <CardDescription>
          Click a route to focus it on the map and inspect its outlets.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[26rem]">
          <div className="flex flex-col gap-2 p-3 pt-0">
            {groups.map((group, index) => {
              const hue = clusterHue(index);
              const color = `hsl(${hue} 70% 45%)`;
              const selected = group.id === selectedGroupId;
              const outlets = group.outletIds
                .map((id) => byId.get(id))
                .filter((outlet): outlet is PlannerOutlet => Boolean(outlet));
              return (
                <div
                  key={group.id}
                  className={cn(
                    "overflow-hidden rounded-lg border transition-colors",
                    selected ? "border-primary/60 bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-2 p-3">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <Input
                      value={group.name}
                      onChange={(event) => onRename(group.id, event.target.value)}
                      className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1 text-sm font-medium shadow-none focus:border-ring"
                      aria-label={`Route name for ${group.name}`}
                    />
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                      style={{ backgroundColor: `${color}22`, color }}
                      title={`${group.outletIds.length} outlet${group.outletIds.length === 1 ? "" : "s"}`}
                    >
                      {group.outletIds.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 px-0 text-muted-foreground hover:text-foreground"
                      onClick={() => onSelect(selected ? null : group.id)}
                      title={
                        selected
                          ? "Stop focusing this route"
                          : "Focus this route on the map"
                      }
                      aria-label={`${selected ? "Stop focusing" : "Focus"} ${group.name} on the map`}
                    >
                      <MapPinned className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 px-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveGroup(group.id)}
                      aria-label={`Remove ${group.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                  {selected && (
                    <div className="flex flex-col gap-0.5 border-t p-2">
                      {outlets.length === 0 ? (
                        <p className="px-1 py-1 text-xs text-muted-foreground">
                          Empty — click unassigned dots on the map to add outlets.
                        </p>
                      ) : (
                        outlets.map((outlet, outletIndex) => (
                          <div
                            key={outlet.id}
                            className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/60"
                          >
                            <span
                              className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold tabular-nums"
                              style={{ backgroundColor: `${color}26`, color }}
                              title={`Stop ${outletIndex + 1}`}
                            >
                              {outletIndex + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => onFocusOutlet(outlet.id)}
                              title={`Focus ${outlet.name} on the map`}
                              className="min-w-0 flex-1 truncate text-left text-xs hover:text-foreground hover:underline"
                            >
                              {outlet.name}
                            </button>
                            <Select
                              value={group.id}
                              onValueChange={(target) => onAssign(outlet.id, target)}
                            >
                              <SelectTrigger
                                className="h-7 w-24 shrink-0 text-xs opacity-60 transition-opacity group-hover:opacity-100"
                                aria-label={`Move ${outlet.name} to…`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {groups.map((target) => (
                                  <SelectItem key={target.id} value={target.id}>
                                    {target.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 shrink-0 px-0 text-muted-foreground opacity-60 transition-opacity hover:text-destructive group-hover:opacity-100"
                              onClick={() => onRemoveOutlet(outlet.id, group.id)}
                              aria-label={`Remove ${outlet.name} from ${group.name}`}
                            >
                              <X className="size-3.5" aria-hidden />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Selected outlet actions
// ---------------------------------------------------------------------------

function SelectionPanel({
  outlet,
  group,
  groups,
  onAssign,
  onRemove,
  onDeselect,
}: {
  outlet: PlannerOutlet | null;
  group: PlannedGroup | null;
  groups: PlannedGroup[];
  onAssign: (outletId: string, groupId: string) => void;
  onRemove: (outletId: string, groupId: string) => void;
  onDeselect: () => void;
}) {
  if (!outlet) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          Click an outlet on the map to inspect or assign it to a route.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{outlet.name}</CardTitle>
            <CardDescription>
              {group
                ? `On “${group.name}”`
                : outlet.routeId
                  ? "On an existing route"
                  : "Unassigned"}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 px-0 text-muted-foreground"
            onClick={onDeselect}
            aria-label="Deselect outlet"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {group ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(outlet.id, group.id)}
              className="text-destructive hover:text-destructive"
            >
              Remove from route
            </Button>
            <div className="flex items-center gap-2">
              <Select value={group.id} onValueChange={(target) => onAssign(outlet.id, target)}>
                <SelectTrigger className="flex-1 text-sm">
                  <SelectValue placeholder="Move to…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : outlet.routeId ? (
          <p className="text-xs text-muted-foreground">
            Already on an existing route — it is shown dimmed on the map. Plan it
            in another route to link it there too.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Assign this outlet to a planned route:
            </p>
            {groups.length === 0 ? (
              <p className="text-xs font-medium text-foreground">
                Auto-cluster first to create routes.
              </p>
            ) : (
              <Select value="" onValueChange={(target) => onAssign(outlet.id, target)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Assign to route…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
