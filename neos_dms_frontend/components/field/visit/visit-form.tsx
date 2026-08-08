"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/http";
import {
  outletApi,
  routeApi,
  visitApi,
  type Outlet,
} from "@/lib/api/field";
import { queryKeys } from "@/lib/query/keys";
import { createVisitSchema, type CreateVisitValues } from "@/lib/validation/field";

interface VisitFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisitFormSheet({ open, onOpenChange }: VisitFormSheetProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateVisitValues>({
    resolver: zodResolver(createVisitSchema),
    defaultValues: {
      routeId: "",
      outletId: "",
      visitType: "PLANNED",
    },
  });

  const selectedRoute = useWatch({ control: form.control, name: "routeId" });

  React.useEffect(() => {
    if (open) {
      form.reset({ routeId: "", outletId: "", visitType: "PLANNED" });
    }
  }, [open, form]);

  const { data: routes } = useQuery({
    queryKey: queryKeys.field.routeList({ page: 1, limit: 100 }),
    queryFn: () => routeApi.list({ page: 1, limit: 100 }),
    enabled: open,
  });

  const { data: outlets } = useQuery({
    queryKey: queryKeys.field.outletList({ page: 1, limit: 100, routeId: selectedRoute }),
    queryFn: () => outletApi.list({ page: 1, limit: 100, routeId: selectedRoute }),
    enabled: open && selectedRoute !== "",
  });

  const mutation = useMutation({
    mutationFn: (values: CreateVisitValues) => visitApi.create(values),
    onSuccess: () => {
      toast.success("Visit scheduled.");
      queryClient.invalidateQueries({ queryKey: ["field", "visits"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not schedule the visit."));
    },
  });

  function onSubmit(values: CreateVisitValues) {
    mutation.mutate(values);
  }

  const activeRoutes = (routes?.data ?? []).filter(
    (route) => route.status === "ACTIVE",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Schedule a visit</SheetTitle>
          <SheetDescription>
            Plan a field visit to an outlet on one of your assigned routes.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <FormField
              control={form.control}
              name="routeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Route</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("outletId", "");
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a route" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeRoutes.map((route) => (
                        <SelectItem key={route.id} value={route.id}>
                          {route.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="outletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outlet</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={selectedRoute === ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            selectedRoute === ""
                              ? "Pick a route first"
                              : "Select an outlet"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(outlets?.data ?? []).map((outlet: Outlet) => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          {outlet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="visitType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visit type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PLANNED">Planned</SelectItem>
                      <SelectItem value="UNPLANNED">Unplanned</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Schedule visit
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
