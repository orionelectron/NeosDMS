"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getErrorMessage } from "@/lib/api/http";
import {
  locationApi,
  movementApi,
  type InventoryLineDto,
} from "@/lib/api/inventory";
import { itemApi, uomApi, type Item } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import {
  lineSchema,
  type InventoryLineValues,
} from "@/lib/validation/inventory";
import { MovementLineEditor } from "@/components/inventory/movement/movement-line-editor";

export type MovementMode = "opening" | "adjustment" | "transfer";

interface MovementFormValues {
  locationId: string;
  fromLocationId: string;
  toLocationId: string;
  lines: InventoryLineValues[];
  notes: string;
}

const MODE_META: Record<
  MovementMode,
  { title: string; description: string; submitLabel: string }
> = {
  opening: {
    title: "Opening stock",
    description:
      "Record the initial stock on hand at a location. Done once per item.",
    submitLabel: "Post opening stock",
  },
  adjustment: {
    title: "Stock adjustment",
    description:
      "Add or remove stock to correct the on-hand balance for a location.",
    submitLabel: "Post adjustment",
  },
  transfer: {
    title: "Transfer stock",
    description: "Move stock between two locations in a single transaction.",
    submitLabel: "Post transfer",
  },
};

function emptyLine(): InventoryLineValues {
  return {
    itemId: "",
    uomId: "",
    direction: undefined,
    quantity: "",
    unitCost: "",
  };
}

function buildSchema(mode: MovementMode) {
  return z
    .object({
      locationId: z.string(),
      fromLocationId: z.string(),
      toLocationId: z.string(),
      lines: z.array(lineSchema).min(1, "Add at least one line"),
      notes: z.string().trim(),
    })
    .superRefine((data, ctx) => {
      if (mode === "transfer") {
        if (!data.fromLocationId) {
          ctx.addIssue({
            code: "custom",
            path: ["fromLocationId"],
            message: "Source location is required",
          });
        }
        if (!data.toLocationId) {
          ctx.addIssue({
            code: "custom",
            path: ["toLocationId"],
            message: "Destination location is required",
          });
        }
        if (
          data.fromLocationId &&
          data.toLocationId &&
          data.fromLocationId === data.toLocationId
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["toLocationId"],
            message: "Choose a different destination location",
          });
        }
      } else if (!data.locationId) {
        ctx.addIssue({
          code: "custom",
          path: ["locationId"],
          message: "Location is required",
        });
      }
    });
}

export interface MovementInitial {
  locationId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  lines?: Array<{ itemId: string; uomId: string }>;
}

interface MovementFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MovementMode;
  /** Pre-fill values, e.g. when adjusting stock from a balance row. */
  initial?: MovementInitial;
}

export function MovementFormSheet({
  open,
  onOpenChange,
  mode,
  initial,
}: MovementFormSheetProps) {
  const queryClient = useQueryClient();
  const meta = MODE_META[mode];
  const showDirection = mode === "adjustment";
  const showCost = mode !== "transfer";

  const { data: locationData } = useQuery({
    queryKey: queryKeys.inventory.locationList({ limit: 100 }),
    queryFn: () => locationApi.list({ limit: 100 }),
  });
  const { data: itemData } = useQuery({
    queryKey: queryKeys.trading.itemList({ limit: 100 }),
    queryFn: () => itemApi.list({ limit: 100 }),
  });
  const { data: uomData } = useQuery({
    queryKey: queryKeys.trading.uomList({ limit: 100 }),
    queryFn: () => uomApi.list({ limit: 100 }),
  });

  const locations = React.useMemo(
    () =>
      (locationData?.data ?? []).filter((location) => location.isActive),
    [locationData],
  );

  const items = React.useMemo(
    () =>
      (itemData?.data ?? []).filter(
        (item: Item) => item.isActive && item.inventoryTracking === "QUANTITY",
      ),
    [itemData],
  );
  const uoms = React.useMemo(
    () => (uomData?.data ?? []).filter((uom) => uom.isActive),
    [uomData],
  );

  const schema = React.useMemo(() => buildSchema(mode), [mode]);

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      locationId: "",
      fromLocationId: "",
      toLocationId: "",
      lines: [emptyLine()],
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        locationId:
          initial?.locationId ??
          locations.find((location) => location.isDefault)?.id ??
          "",
        fromLocationId: initial?.fromLocationId ?? "",
        toLocationId: initial?.toLocationId ?? "",
        lines: initial?.lines?.length
          ? initial.lines.map((line) => ({
              itemId: line.itemId,
              uomId: line.uomId,
              direction: "IN",
              quantity: "",
              unitCost: "",
            }))
          : [emptyLine()],
        notes: "",
      });
    }
  }, [open, form, locations, initial]);

  const mutation = useMutation({
    mutationFn: (values: MovementFormValues) => {
      const lines: InventoryLineDto[] = values.lines.map((line) => ({
        itemId: line.itemId,
        uomId: line.uomId,
        ...(showDirection
          ? { direction: (line.direction ?? "IN") as "IN" | "OUT" }
          : {}),
        quantity: Number(line.quantity),
        ...(showCost && line.unitCost !== ""
          ? { unitCost: Number(line.unitCost) }
          : {}),
      }));
      const notes = values.notes === "" ? undefined : values.notes;
      if (mode === "transfer") {
        return movementApi.transfer({
          fromLocationId: values.fromLocationId,
          toLocationId: values.toLocationId,
          lines,
          notes,
        });
      }
      if (mode === "adjustment") {
        return movementApi.adjustment({
          locationId: values.locationId,
          lines,
          notes,
        });
      }
      return movementApi.openingStock({
        locationId: values.locationId,
        lines,
        notes,
      });
    },
    onSuccess: () => {
      toast.success(meta.submitLabel.replace("Post", "Posted"));
      queryClient.invalidateQueries({ queryKey: ["inventory", "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "balances"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "low-stock"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not post the stock movement."));
    },
  });

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{meta.title}</SheetTitle>
          <SheetDescription>{meta.description}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            {mode === "transfer" ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Source location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
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
                  name="toLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Destination location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-2">
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Lines{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({fields.length})
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append(emptyLine())}
                >
                  <Plus className="size-4" aria-hidden />
                  Add line
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Only quantity-tracked items can be moved.
              </p>
              {showCost && (
                <p className="text-xs text-muted-foreground">
                  {mode === "opening"
                    ? "Unit cost is the per-unit cost used to value stock — pre-filled from the item's retail list price when available. It becomes the moving-average cost shown as Avg cost in Stock balances."
                    : "Unit cost is optional — leave blank to keep the current average cost."}
                </p>
              )}
              {fields.map((field, index) => (
                <MovementLineEditor
                  key={field.id}
                  index={index}
                  items={items}
                  uoms={uoms}
                  showDirection={showDirection}
                  showCost={showCost}
                  onRemove={() => remove(index)}
                />
              ))}
              {errors.lines?.root?.message && (
                <p className="text-sm font-medium text-destructive">
                  {errors.lines.root.message}
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this movement"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
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
                {meta.submitLabel}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
