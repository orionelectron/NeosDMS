"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/http";
import {
  conversionApi,
  itemApi,
  uomApi,
  type Uom,
} from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import {
  conversionSchema,
  type ConversionValues,
} from "@/lib/validation/trading";

const NO_ITEM = "none";

interface ConversionFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lock the conversion to one item (item detail page) — hides the item select. */
  lockedItemId?: string;
}

export function ConversionFormSheet({
  open,
  onOpenChange,
  lockedItemId,
}: ConversionFormSheetProps) {
  const queryClient = useQueryClient();

  const { data: itemData } = useQuery({
    queryKey: queryKeys.trading.itemList({ limit: 100 }),
    queryFn: () => itemApi.list({ limit: 100 }),
  });
  const { data: uomData } = useQuery({
    queryKey: queryKeys.trading.uomList({ limit: 100 }),
    queryFn: () => uomApi.list({ limit: 100 }),
  });

  const items = itemData?.data ?? [];
  const uoms = uomData?.data ?? [];

  const form = useForm<ConversionValues>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      itemId: lockedItemId ?? NO_ITEM,
      fromUomId: "",
      toUomId: "",
      conversionFactor: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        itemId: lockedItemId ?? NO_ITEM,
        fromUomId: "",
        toUomId: "",
        conversionFactor: "",
      });
    }
  }, [open, lockedItemId, form]);

  const itemId = useWatch({ control: form.control, name: "itemId" });
  const fromUomId = useWatch({ control: form.control, name: "fromUomId" });
  const toUomId = useWatch({ control: form.control, name: "toUomId" });
  const conversionFactor = useWatch({
    control: form.control,
    name: "conversionFactor",
  });

  const fromUom: Uom | undefined = uoms.find((uom) => uom.id === fromUomId);
  const toUom: Uom | undefined = uoms.find((uom) => uom.id === toUomId);
  const selectedItem = items.find((item) => item.id === itemId);

  const mutation = useMutation({
    mutationFn: (values: ConversionValues) =>
      conversionApi.create({
        itemId:
          lockedItemId ??
          (values.itemId === NO_ITEM ? null : values.itemId),
        fromUomId: values.fromUomId,
        toUomId: values.toUomId,
        conversionFactor: Number(values.conversionFactor),
      }),
    onSuccess: () => {
      toast.success("Conversion created.");
      queryClient.invalidateQueries({ queryKey: ["trading", "conversions"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the conversion."));
    },
  });

  function onSubmit(values: ConversionValues) {
    mutation.mutate(values);
  }

  const factorNumber = Number(conversionFactor);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New conversion</SheetTitle>
          <SheetDescription>
            Define how units relate — 1 from-unit equals N to-units.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            {!lockedItemId && (
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_ITEM}>
                          All items (global)
                        </SelectItem>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Leave global to apply to every item.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="fromUomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From unit</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={uoms.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="From" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {uoms.map((uom) => (
                          <SelectItem key={uom.id} value={uom.id}>
                            {uom.name} ({uom.shortName})
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
                name="toUomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To unit</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={uoms.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="To" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {uoms.map((uom) => (
                          <SelectItem key={uom.id} value={uom.id}>
                            {uom.name} ({uom.shortName})
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
              name="conversionFactor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conversion factor</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="e.g. 12"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    How many to-units equal one from-unit.{" "}
                    {fromUom && toUom && factorNumber > 0 && (
                      <span className="font-medium text-foreground">
                        1 {fromUom.shortName} = {conversionFactor}{" "}
                        {toUom.shortName}
                      </span>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedItem && lockedItemId && (
              <p className="text-xs text-muted-foreground">
                This conversion applies only to{" "}
                <span className="font-medium text-foreground">
                  {selectedItem.name}
                </span>
                .
              </p>
            )}

            <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="ml-auto"
                >
                  {mutation.isPending && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  Create conversion
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
