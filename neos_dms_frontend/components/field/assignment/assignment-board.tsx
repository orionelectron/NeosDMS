"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import { userApi } from "@/lib/api/iam";
import {
  routeApi,
  routeAssignmentApi,
  type RouteAssignment,
} from "@/lib/api/field";
import { queryKeys } from "@/lib/query/keys";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { WEEKDAY_OPTIONS } from "@/lib/validation/field";

const FETCH_LIMIT = 100;

const ALL_DAYS = WEEKDAY_OPTIONS.map((day) => day.value);

function daysFromStored(stored: number[]): number[] {
  return stored.length === 0 ? [...ALL_DAYS] : [...stored].sort((a, b) => a - b);
}

function storedFromDays(days: number[]): number[] {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  return sorted.length === ALL_DAYS.length ? [] : sorted;
}

interface OverlapInfo {
  routeId: string;
  day: number;
}

export function AssignmentBoard() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("sales.route_assignment.create");
  const canUpdate = can("sales.route_assignment.update");
  const canDelete = can("sales.route_assignment.delete");

  const [searchInput, setSearchInput] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<RouteAssignment | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => setSearchInput(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { data: users, isPending: usersPending } = useQuery({
    queryKey: queryKeys.iam.userList({ page: 1, limit: FETCH_LIMIT }),
    queryFn: () => userApi.list({ page: 1, limit: FETCH_LIMIT }),
  });

  const { data: routes, isPending: routesPending } = useQuery({
    queryKey: queryKeys.field.routeList({ page: 1, limit: FETCH_LIMIT }),
    queryFn: () => routeApi.list({ page: 1, limit: FETCH_LIMIT }),
  });

  const assignmentsQuery = queryKeys.field.assignmentList({
    page: 1,
    limit: FETCH_LIMIT,
  });
  const { data: assignmentsData, isPending: assignmentsPending } = useQuery({
    queryKey: assignmentsQuery,
    queryFn: () => routeAssignmentApi.list({ page: 1, limit: FETCH_LIMIT }),
  });

  const salesUsers = React.useMemo(
    () =>
      (users?.data ?? []).filter(
        (user) => user.isActive && user.role?.code === "salesman",
      ),
    [users],
  );
  const activeRoutes = React.useMemo(
    () => (routes?.data ?? []).filter((route) => route.status === "ACTIVE"),
    [routes],
  );

  const assignments = React.useMemo(() => assignmentsData?.data ?? [], [
    assignmentsData,
  ]);

  const assignmentsByUser = React.useMemo(() => {
    const map = new Map<string, RouteAssignment[]>();
    for (const assignment of assignments) {
      const list = map.get(assignment.userId) ?? [];
      list.push(assignment);
      map.set(assignment.userId, list);
    }
    return map;
  }, [assignments]);

  const overlaps = React.useMemo(() => {
    const coverage = new Map<string, Map<number, number>>();
    const result: OverlapInfo[] = [];
    for (const assignment of assignments) {
      const days = daysFromStored(assignment.weekdays);
      const routeCoverage = coverage.get(assignment.routeId) ?? new Map();
      for (const day of days) {
        routeCoverage.set(day, (routeCoverage.get(day) ?? 0) + 1);
      }
      coverage.set(assignment.routeId, routeCoverage);
    }
    for (const [routeId, days] of coverage) {
      for (const [day, count] of days) {
        if (count > 1) result.push({ routeId, day });
      }
    }
    return result;
  }, [assignments]);

  const overlapByRouteDay = React.useMemo(() => {
    const set = new Set<string>();
    for (const { routeId, day } of overlaps) {
      set.add(`${routeId}:${day}`);
    }
    return set;
  }, [overlaps]);

  const filteredUsers = React.useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    if (!term) return salesUsers;
    return salesUsers.filter(
      (user) =>
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term),
    );
  }, [salesUsers, searchInput]);

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      weekdays,
    }: {
      id: string;
      weekdays: number[];
    }) => routeAssignmentApi.update(id, { weekdays }),
    onMutate: async ({ id, weekdays }) => {
      await queryClient.cancelQueries({ queryKey: assignmentsQuery });
      const previous = queryClient.getQueryData(assignmentsQuery);
      queryClient.setQueryData<{ data: RouteAssignment[] }>(assignmentsQuery, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((assignment) =>
                assignment.id === id ? { ...assignment, weekdays } : assignment,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (error: unknown, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(assignmentsQuery, context.previous);
      }
      toast.error(getErrorMessage(error, "Could not update the schedule."));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsQuery });
    },
  });

  const createMutation = useMutation({
    mutationFn: (dto: { userId: string; routeId: string }) =>
      routeAssignmentApi.create(dto),
    onSuccess: () => {
      toast.success("Route assigned.");
      queryClient.invalidateQueries({ queryKey: assignmentsQuery });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not assign the route."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (assignment: RouteAssignment) =>
      routeAssignmentApi.remove(assignment.id),
    onSuccess: (_data, assignment) => {
      toast.success(
        `${assignment.user.fullName} no longer covers ${assignment.route.name}.`,
      );
      queryClient.invalidateQueries({ queryKey: assignmentsQuery });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not remove the assignment."));
    },
  });

  const pending =
    usersPending || routesPending || assignmentsPending;
  const totalUsers = salesUsers.length;
  const totalAssigned = assignments.length;
  const overlapCount = overlaps.length;

  return (
    <PageContainer
      icon={UserRound}
      title="Route assignments"
      description="A coverage board: who covers which route, and on which days."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{totalUsers} salespeople</Badge>
          <Badge variant="secondary">{totalAssigned} assigned routes</Badge>
          {overlapCount > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-700"
            >
              <AlertTriangle className="size-3" aria-hidden />
              {overlapCount} weekday overlap
              {overlapCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search salespeople…"
            className="w-64 pl-9"
            aria-label="Search salespeople"
          />
        </div>
      </div>

      {pending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <UserRound className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <p className="text-sm font-medium">
              {searchInput
                ? "No salespeople match your search."
                : "No salespeople yet."}
            </p>
            <p className="text-xs text-muted-foreground">
              {searchInput
                ? "Try a different name or email."
                : "Assign a user the sales role, then assign routes here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredUsers.map((user) => {
            const userAssignments = assignmentsByUser.get(user.id) ?? [];
            const assignedRouteIds = new Set(
              userAssignments.map((assignment) => assignment.routeId),
            );
            const assignableRoutes = activeRoutes.filter(
              (route) => !assignedRouteIds.has(route.id),
            );

            return (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(user.fullName || user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate">{user.fullName}</CardTitle>
                        <CardDescription className="truncate">
                          {user.email}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">
                        {userAssignments.length}{" "}
                        {userAssignments.length === 1 ? "route" : "routes"}
                      </Badge>
                      {canCreate && assignableRoutes.length > 0 && (
                        <Combobox
                          value=""
                          onValueChange={(routeId) => {
                            createMutation.mutate({
                              userId: user.id,
                              routeId,
                            });
                          }}
                          options={assignableRoutes.map((route) => ({
                            value: route.id,
                            label: route.name,
                          }))}
                          placeholder="Assign route"
                          emptyText="No unassigned routes."
                          className="w-40"
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {userAssignments.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                      No routes assigned yet.
                    </p>
                  ) : (
                    userAssignments.map((assignment) => {
                      const days = daysFromStored(assignment.weekdays);
                      const anyDay = assignment.weekdays.length === 0;
                      return (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-3 rounded-md border p-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {assignment.route.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {assignment.route.code}
                              {anyDay && " · Any day"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {WEEKDAY_OPTIONS.map((day) => {
                              const checked = days.includes(day.value);
                              const overlapped = overlapByRouteDay.has(
                                `${assignment.routeId}:${day.value}`,
                              );
                              return (
                                <button
                                  key={day.value}
                                  type="button"
                                  disabled={!canUpdate}
                                  aria-pressed={checked}
                                  aria-label={`${day.label} on ${assignment.route.name}`}
                                  title={
                                    overlapped
                                      ? `${day.label} — also covered by another salesperson`
                                      : day.label
                                  }
                                  onClick={() => {
                                    const next = checked
                                      ? days.filter((value) => value !== day.value)
                                      : [...days, day.value];
                                    updateMutation.mutate({
                                      id: assignment.id,
                                      weekdays: storedFromDays(next),
                                    });
                                  }}
                                  className={cn(
                                    "relative flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs font-medium transition-colors",
                                    checked
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-input text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  {day.label}
                                  {overlapped && (
                                    <span
                                      className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500"
                                      aria-hidden
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(assignment)}
                              disabled={deleteMutation.isPending}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Remove ${assignment.route.name} from ${user.fullName}`}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.user.fullName} will no longer cover{" "}
              {deleteTarget?.route.name}. Existing visits are kept. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
