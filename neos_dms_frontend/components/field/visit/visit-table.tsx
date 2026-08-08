"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  CircleX,
  LogIn,
  LogOut,
  MapPin,
  Plus,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell/page-container";
import { Button } from "@/components/ui/button";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import {
  visitApi,
  type Visit,
  type VisitStatus,
} from "@/lib/api/field";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime, formatTime } from "@/lib/format";
import { VisitFormSheet } from "@/components/field/visit/visit-form";

const PAGE_SIZE = 20;

const VISIT_STATUS_BADGE: Record<
  VisitStatus,
  { label: string; variant: "secondary" | "default" | "destructive" | "outline" }
> = {
  SCHEDULED: { label: "Scheduled", variant: "secondary" },
  CHECKED_IN: { label: "Checked in", variant: "default" },
  CHECKED_OUT: { label: "Checked out", variant: "secondary" },
  COMPLETED: { label: "Completed", variant: "outline" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "error"; message: string };

function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) =>
        reject(
          new Error(
            error.message ||
              "Could not get your location. Check browser permissions.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function CheckInOutDialog({
  visit,
  mode,
  open,
  onOpenChange,
}: {
  visit: Visit | null;
  mode: "in" | "out";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = React.useState("");
  const [geo, setGeo] = React.useState<GeoState>({ status: "idle" });

  const mutation = useMutation({
    mutationFn: async (latLng: { lat: number; lng: number }) => {
      if (!visit) throw new Error("No visit selected.");
      const dto = {
        latitude: latLng.lat,
        longitude: latLng.lng,
        remarks: remarks.trim() || undefined,
      };
      return mode === "in"
        ? visitApi.checkIn(visit.id, dto)
        : visitApi.checkOut(visit.id, dto);
    },
    onSuccess: () => {
      toast.success(mode === "in" ? "Checked in." : "Checked out.");
      queryClient.invalidateQueries({ queryKey: ["field", "visits"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not check in."));
      setGeo({ status: "idle" });
    },
  });

  function handleConfirm() {
    if (geo.status === "locating") return;
    if (geo.status === "ready") {
      mutation.mutate({ lat: geo.lat, lng: geo.lng });
      return;
    }
    setGeo({ status: "locating" });
    getPosition()
      .then((position) => {
        setGeo({ status: "ready", ...position });
        mutation.mutate(position);
      })
      .catch((error: unknown) => {
        setGeo({
          status: "error",
          message: getErrorMessage(error, "Could not get your location."),
        });
      });
  }

  const outlet = visit?.outlet;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === "in" ? "Check in" : "Check out"} at {outlet?.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "in"
              ? "Confirm you are at the outlet. Your device location is sent with the check-in."
              : "Finish this visit. Your device location is sent with the check-out."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {geo.status === "error" && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {geo.message}
          </p>
        )}
        <label
          htmlFor="visit-remarks"
          className="block space-y-1.5 text-sm font-medium"
        >
          Remarks
          <Textarea
            id="visit-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Optional notes for this visit"
            rows={3}
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="default"
            onClick={handleConfirm}
            disabled={mutation.isPending || geo.status === "locating"}
          >
            {mutation.isPending || geo.status === "locating" ? (
              <>
                <MapPin className="size-4 animate-pulse" aria-hidden />
                {geo.status === "locating" ? "Locating…" : "Checking…"}
              </>
            ) : mode === "in" ? (
              <>
                <LogIn className="size-4" aria-hidden />
                Check in
              </>
            ) : (
              <>
                <LogOut className="size-4" aria-hidden />
                Check out
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function VisitTable() {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("sales.visit.create");
  const canCheckIn = can("sales.visit.check_in");
  const canCheckOut = can("sales.visit.check_out");
  const canCancel = can("sales.visit.cancel");

  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [activeVisit, setActiveVisit] = React.useState<Visit | null>(null);
  const [actionMode, setActionMode] = React.useState<"in" | "out" | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Visit | null>(null);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.field.visitList({ page, limit: PAGE_SIZE }),
    queryFn: () => visitApi.list({ page, limit: PAGE_SIZE }),
  });

  const total = data?.meta.total ?? 0;

  const cancelMutation = useMutation({
    mutationFn: (visit: Visit) => visitApi.cancel(visit.id),
    onSuccess: () => {
      toast.success("Visit cancelled.");
      queryClient.invalidateQueries({ queryKey: ["field", "visits"] });
      setCancelTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not cancel the visit."));
    },
  });

  const rows = data?.data ?? [];

  function openAction(visit: Visit, mode: "in" | "out") {
    setActiveVisit(visit);
    setActionMode(mode);
  }

  return (
    <PageContainer
      icon={CalendarClock}
      title="Field visits"
      description="Planned and unplanned visits to outlets across your routes."
      actions={
        canCreate ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Schedule visit
          </Button>
        ) : undefined
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All visits</CardTitle>
            <CardDescription>
              {isPending ? "Loading…" : `${total} visit${total === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Outlet</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Salesperson</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Times</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-8 w-40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-40 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <CalendarClock
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      <p className="text-sm font-medium">No visits yet</p>
                      <p className="text-xs text-muted-foreground">
                        Schedule a visit to an outlet on one of your routes.
                      </p>
                      {canCreate && (
                        <Button size="sm" onClick={() => setFormOpen(true)}>
                          <Plus className="size-4" aria-hidden />
                          Schedule visit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((visit) => {
                  const badge = VISIT_STATUS_BADGE[visit.status];
                  const isMine =
                    user !== null && visit.user.id === user.id;
                  return (
                    <TableRow key={visit.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {visit.outlet.name}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {visit.outlet.district ?? visit.outlet.address}
                          </p>
                        </div>
                      </TableCell>                      <TableCell>{visit.route.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {visit.user.fullName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {visit.visitType === "PLANNED" ? "Planned" : "Unplanned"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {visit.checkedInAt ? (
                          <>
                            <div>
                              In: {formatDateTime(visit.checkedInAt)}
                            </div>
                            <div>
                              Out:{" "}
                              {visit.checkedOutAt
                                ? formatTime(visit.checkedOutAt)
                                : "—"}
                            </div>
                          </>
                        ) : (
                          formatDateTime(visit.createdAt)
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {visit.status === "SCHEDULED" &&
                            canCheckIn &&
                            isMine && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAction(visit, "in")}
                              >
                                <LogIn className="size-4" aria-hidden />
                                Check in
                              </Button>
                            )}
                          {visit.status === "CHECKED_IN" &&
                            canCheckOut &&
                            isMine && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAction(visit, "out")}
                              >
                                <LogOut className="size-4" aria-hidden />
                                Check out
                              </Button>
                            )}
                          {visit.status === "SCHEDULED" && canCancel && isMine && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelTarget(visit)}
                              disabled={cancelMutation.isPending}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <CircleX className="size-4" aria-hidden />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        {!isPending && (
          <CardFooter className="shrink-0 border-t px-5 py-3">
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </CardFooter>
        )}
      </Card>

      <VisitFormSheet open={formOpen} onOpenChange={setFormOpen} />

      <CheckInOutDialog
        key={activeVisit ? `${activeVisit.id}-${actionMode}` : "closed"}
        visit={activeVisit}
        mode={actionMode ?? "in"}
        open={actionMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActionMode(null);
            setActiveVisit(null);
          }
        }}
      />

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this visit?</AlertDialogTitle>
            <AlertDialogDescription>
              The visit to {cancelTarget?.outlet.name} will be marked as
              cancelled and removed from your schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep visit</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (cancelTarget) cancelMutation.mutate(cancelTarget);
              }}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel visit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
