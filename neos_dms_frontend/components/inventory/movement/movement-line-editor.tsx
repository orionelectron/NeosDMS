"use client";

import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Item, Uom } from "@/lib/api/trading";
import { INVENTORY_DIRECTIONS } from "@/lib/api/inventory";
import { formatNumber } from "@/lib/format";

interface MovementLineEditorProps {
  index: number;
  items: Item[];
  uoms: Uom[];
  showDirection?: boolean;
  showCost?: boolean;
  onRemove: () => void;
  /** When set, shows the current on-hand for the line's item + location. */
  showOnHand?: boolean;
  /** Form field holding the location (locationId vs fromLocationId). */
  locationFieldName?: string;
  /** On-hand lookup keyed by `${locationId}:${itemId}` (base-UOM qty). */
  onHandByKey?: Map<string, string>;
}

export function MovementLineEditor({
  index,
  items,
  uoms,
  showDirection = false,
  showCost = false,
  onRemove,
  showOnHand = false,
  locationFieldName = "locationId",
  onHandByKey,
}: MovementLineEditorProps) {
  const form = useFormContext();

  const locationId = form.watch(locationFieldName);
  const itemId = form.watch(`lines.${index}.itemId`);
  const selectedItem = items.find((candidate) => candidate.id === itemId);
  const onHand =
    showOnHand && locationId && itemId
      ? onHandByKey?.get(`${locationId}:${itemId}`)
      : undefined;

  function handleItemChange(itemId: string, onChange: (value: string) => void) {
    onChange(itemId);
    const item = items.find((candidate) => candidate.id === itemId);
    if (item) {
      form.setValue(`lines.${index}.uomId`, item.baseUomId);
      if (showCost) {
        const currentCost = form.getValues(`lines.${index}.unitCost`) ?? "";
        const standardCost = Number(item.standardCost);
        if (currentCost === "" && standardCost > 0) {
          form.setValue(`lines.${index}.unitCost`, String(standardCost));
        }
      }
    }
  }

  return (
    <div className="space-y-1 rounded-lg border p-2">
      <div className="flex flex-wrap items-end gap-2">
        <FormField
          control={form.control}
          name={`lines.${index}.itemId`}
          render={({ field }) => (
            <FormItem className="min-w-40 flex-1">
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    handleItemChange(value, field.onChange)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`lines.${index}.uomId`}
          render={({ field }) => (
            <FormItem className="w-24">
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {uoms.map((uom) => (
                      <SelectItem key={uom.id} value={uom.id}>
                        {uom.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showDirection && (
          <FormField
            control={form.control}
            name={`lines.${index}.direction`}
            render={({ field }) => (
              <FormItem className="w-24">
                <FormControl>
                  <Select
                    value={field.value ?? "IN"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVENTORY_DIRECTIONS.map((direction) => (
                        <SelectItem key={direction} value={direction}>
                          {direction}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name={`lines.${index}.quantity`}
          render={({ field }) => (
            <FormItem className="w-28">
              <FormControl>
                <Input
                  placeholder="Qty"
                  inputMode="decimal"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showCost && (
          <FormField
            control={form.control}
            name={`lines.${index}.unitCost`}
            render={({ field }) => (
              <FormItem className="w-32">
                <FormControl>
                  <Input
                    placeholder="Unit cost"
                    inputMode="decimal"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove line"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
      {showOnHand && locationId && itemId && (
        <div className="flex items-center justify-between border-t border-dashed px-1 pb-0.5 pt-1 text-xs text-muted-foreground">
          <span>On hand at this location</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatNumber(onHand ?? "0")}{" "}
            {selectedItem?.baseUom?.shortName ?? ""}
          </span>
        </div>
      )}
    </div>
  );
}
