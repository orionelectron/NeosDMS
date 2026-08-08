"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/http";
import {
  branchApi,
  type Branch,
} from "@/lib/api/accounting";
import {
  INVENTORY_LOCATION_TYPES,
  locationApi,
  type InventoryLocation,
} from "@/lib/api/inventory";
import {
  locationSchema,
  type LocationValues,
} from "@/lib/validation/inventory";

const LOCATION_TYPE_LABELS: Record<string, string> = {
  GODOWN: "Godown",
  VAN: "Van",
  SHOP: "Shop",
  WAREHOUSE: "Warehouse",
};

interface LocationFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: InventoryLocation | null;
}

export function LocationFormSheet({
  open,
  onOpenChange,
  location,
}: LocationFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(location);

  const { data: branchData } = useQuery({
    queryKey: ["accounting", "branches"],
    queryFn: () => branchApi.list(),
  });

  const form = useForm<LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      code: "",
      locationType: "GODOWN",
      branchId: "",
      address: "",
      notes: "",
      isDefault: false,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        location
          ? {
              name: location.name,
              code: location.code,
              locationType: location.locationType,
              branchId: location.branchId ?? "",
              address: location.address ?? "",
              notes: location.notes ?? "",
              isDefault: location.isDefault,
            }
          : {
              name: "",
              code: "",
              locationType: "GODOWN",
              branchId: "",
              address: "",
              notes: "",
              isDefault: false,
            },
      );
    }
  }, [open, location, form]);

  const mutation = useMutation({
    mutationFn: (values: LocationValues) => {
      const dto = {
        name: values.name,
        code: values.code,
        locationType: values.locationType,
        branchId: values.branchId === "" ? undefined : values.branchId,
        address: values.address === "" ? undefined : values.address,
        notes: values.notes === "" ? undefined : values.notes,
        isDefault: values.isDefault,
      };
      return location
        ? locationApi.update(location.id, dto)
        : locationApi.create(dto);
    },
    onSuccess: () => {
      toast.success(editing ? "Location updated." : "Location created.");
      queryClient.invalidateQueries({ queryKey: ["inventory", "locations"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the location."));
    },
  });

  function onSubmit(values: LocationValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {editing ? "Edit location" : "New location"}
          </SheetTitle>
          <SheetDescription>
            A physical place where stock is held, e.g. a godown or shop.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Main Godown" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. MG-1"
                        {...field}
                        disabled={editing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="locationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVENTORY_LOCATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {LOCATION_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No branch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(branchData ?? []).map((branch: Branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. New Baneshwor, Kathmandu" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this location"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Default location</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      The primary store used when no location is specified.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <SheetFooter className="pt-2">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {editing ? "Save changes" : "Create location"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
