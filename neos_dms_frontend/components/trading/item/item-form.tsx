"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { getErrorMessage } from "@/lib/api/http";
import { accountApi, taxApi, type Account } from "@/lib/api/accounting";
import {
  brandApi,
  categoryApi,
  INVENTORY_TRACKINGS,
  itemApi,
  ITEM_TYPES,
  uomApi,
  VALUATION_METHODS,
  type Item,
} from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { itemSchema, type ItemValues } from "@/lib/validation/trading";

const NO_SELECT = "none";

const ITEM_TYPE_LABELS: Record<string, string> = {
  GOODS: "Goods",
  SERVICE: "Service",
  RAW: "Raw material",
  ASSET: "Asset",
};

const VALUATION_METHOD_LABELS: Record<string, string> = {
  FIFO: "FIFO",
  WEIGHTED_AVERAGE: "Weighted average",
};

const INVENTORY_TRACKING_LABELS: Record<string, string> = {
  NONE: "None",
  QUANTITY: "Quantity",
  BATCH: "Batch",
  SERIAL: "Serial",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Separator className="flex-1" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

const createDefaults: ItemValues = {
  name: "",
  code: "",
  sku: "",
  barcode: "",
  description: "",
  type: "GOODS",
  categoryId: NO_SELECT,
  brandId: NO_SELECT,
  baseUomId: "",
  hsnCode: "",
  valuationMethod: "FIFO",
  taxCodeId: NO_SELECT,
  mrp: "",
  rlp: "",
  standardCost: "",
  reorderLevel: "",
  inventoryTracking: "QUANTITY",
  trackExpiry: false,
  allowNegativeStock: false,
  salesAccountId: NO_SELECT,
  purchaseAccountId: NO_SELECT,
  salesReturnAccountId: NO_SELECT,
  purchaseReturnAccountId: NO_SELECT,
  isActive: true,
};

interface ItemFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
}

export function ItemFormSheet({
  open,
  onOpenChange,
  item,
}: ItemFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(item);

  const { data: categoryData } = useQuery({
    queryKey: queryKeys.trading.categoryList({ limit: 100 }),
    queryFn: () => categoryApi.list({ limit: 100 }),
  });
  const { data: brandData } = useQuery({
    queryKey: queryKeys.trading.brandList({ limit: 100 }),
    queryFn: () => brandApi.list({ limit: 100 }),
  });
  const { data: uomData } = useQuery({
    queryKey: queryKeys.trading.uomList({ limit: 100 }),
    queryFn: () => uomApi.list({ limit: 100 }),
  });
  const { data: taxData } = useQuery({
    queryKey: ["accounting", "tax", "codes"],
    queryFn: () => taxApi.codes(),
  });
  const { data: accountData } = useQuery({
    queryKey: queryKeys.accounting.accountList({ limit: 100 }),
    queryFn: () => accountApi.list({ limit: 100 }),
  });

  const categories = categoryData?.data ?? [];
  const brands = brandData?.data ?? [];
  const uoms = uomData?.data ?? [];
  const taxCodes = taxData ?? [];
  const accountsAll = accountData?.data ?? [];
  const accountOptions = accountsAll.filter(
    (account: Account) => !account.isGroup && account.isActive,
  );
  const referencedOptions = (accountId: string | null) => {
    if (!accountId) return accountOptions;
    const referenced = accountsAll.find((account) => account.id === accountId);
    if (
      referenced &&
      !accountOptions.some((account) => account.id === accountId)
    ) {
      return [...accountOptions, referenced];
    }
    return accountOptions;
  };

  const form = useForm<ItemValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: createDefaults,
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        item
          ? {
              name: item.name,
              code: item.code ?? "",
              sku: item.sku ?? "",
              barcode: item.barcode ?? "",
              description: item.description ?? "",
              type: item.type,
              categoryId: item.categoryId ?? NO_SELECT,
              brandId: item.brandId ?? NO_SELECT,
              baseUomId: item.baseUomId,
              hsnCode: item.hsnCode ?? "",
              valuationMethod: item.valuationMethod,
              taxCodeId: item.taxCodeId ?? NO_SELECT,
              mrp: item.mrp,
              rlp: item.rlp,
              standardCost: item.standardCost,
              reorderLevel: String(item.reorderLevel),
              inventoryTracking: item.inventoryTracking,
              trackExpiry: item.trackExpiry,
              allowNegativeStock: item.allowNegativeStock,
              salesAccountId: item.salesAccountId ?? NO_SELECT,
              purchaseAccountId: item.purchaseAccountId ?? NO_SELECT,
              salesReturnAccountId: item.salesReturnAccountId ?? NO_SELECT,
              purchaseReturnAccountId:
                item.purchaseReturnAccountId ?? NO_SELECT,
              isActive: item.isActive,
            }
          : createDefaults,
      );
    }
  }, [open, item, form]);

  const mutation = useMutation({
    mutationFn: (values: ItemValues) => {
      const dto = {
        name: values.name,
        code: values.code === "" ? null : values.code,
        sku: values.sku === "" ? null : values.sku,
        barcode: values.barcode === "" ? null : values.barcode,
        description: values.description === "" ? null : values.description,
        type: values.type,
        categoryId: values.categoryId === NO_SELECT ? null : values.categoryId,
        brandId: values.brandId === NO_SELECT ? null : values.brandId,
        baseUomId: values.baseUomId,
        hsnCode: values.hsnCode === "" ? null : values.hsnCode,
        valuationMethod: values.valuationMethod,
        taxCodeId: values.taxCodeId === NO_SELECT ? null : values.taxCodeId,
        mrp: values.mrp === "" ? undefined : Number(values.mrp),
        rlp: values.rlp === "" ? undefined : Number(values.rlp),
        standardCost:
          values.standardCost === "" ? undefined : Number(values.standardCost),
        reorderLevel:
          values.reorderLevel === "" ? undefined : Number(values.reorderLevel),
        inventoryTracking: values.inventoryTracking,
        trackExpiry: values.trackExpiry,
        allowNegativeStock: values.allowNegativeStock,
        salesAccountId:
          values.salesAccountId === NO_SELECT ? null : values.salesAccountId,
        purchaseAccountId:
          values.purchaseAccountId === NO_SELECT
            ? null
            : values.purchaseAccountId,
        salesReturnAccountId:
          values.salesReturnAccountId === NO_SELECT
            ? null
            : values.salesReturnAccountId,
        purchaseReturnAccountId:
          values.purchaseReturnAccountId === NO_SELECT
            ? null
            : values.purchaseReturnAccountId,
      };
      return item
        ? itemApi.update(item.id, { ...dto, isActive: values.isActive })
        : itemApi.create(dto);
    },
    onSuccess: () => {
      toast.success(editing ? "Item updated." : "Item created.");
      queryClient.invalidateQueries({ queryKey: ["trading", "items"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the item."));
    },
  });

  function onSubmit(values: ItemValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit item" : "New item"}</SheetTitle>
          <SheetDescription>
            Products, services and raw materials you trade.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <SectionTitle>Identity</SectionTitle>
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Coconut Water 250ml" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. CW-250" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. CW250ML" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 8901234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes for this item"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ITEM_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ITEM_TYPE_LABELS[type] ?? type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SectionTitle>Classification</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_SELECT}>None</SelectItem>
                          {categories.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
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
                  name="brandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No brand" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_SELECT}>None</SelectItem>
                          {brands.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
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
                name="baseUomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base unit</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={uoms.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select base unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {uoms.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name} ({option.shortName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The unit stock is counted in.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SectionTitle>Pricing</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="mrp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MRP</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rlp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RLP</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="standardCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Std cost</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SectionTitle>Tax &amp; HSN</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="taxCodeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax code</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No tax code" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SELECT}>None</SelectItem>
                        {taxCodes.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name} ({Number(option.rate)}%)
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
                name="hsnCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HSN code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2202" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SectionTitle>Inventory</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="valuationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valuation method</FormLabel>
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
                          {VALUATION_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {VALUATION_METHOD_LABELS[method] ?? method}
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
                  name="inventoryTracking"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inventory tracking</FormLabel>
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
                          {INVENTORY_TRACKINGS.map((tracking) => (
                            <SelectItem key={tracking} value={tracking}>
                              {INVENTORY_TRACKING_LABELS[tracking] ?? tracking}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder level</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3 pt-0">
                  <FormField
                    control={form.control}
                    name="trackExpiry"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                        <div>
                          <FormLabel className="mb-0 text-sm">
                            Track expiry
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Batch-level expiry dates
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
                  <FormField
                    control={form.control}
                    name="allowNegativeStock"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                        <div>
                          <FormLabel className="mb-0 text-sm">
                            Allow negative stock
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Permit overselling
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
                </div>
              </div>
            </div>

            <SectionTitle>Accounting</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="salesAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales account</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_SELECT}>None</SelectItem>
                          {referencedOptions(item?.salesAccountId ?? null).map(
                            (option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.code} · {option.name}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchaseAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase account</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_SELECT}>None</SelectItem>
                          {referencedOptions(item?.purchaseAccountId ?? null).map(
                            (option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.code} · {option.name}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="salesReturnAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales return account</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_SELECT}>None</SelectItem>
                          {referencedOptions(
                            item?.salesReturnAccountId ?? null,
                          ).map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.code} · {option.name}
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
                  name="purchaseReturnAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase return account</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_SELECT}>None</SelectItem>
                          {referencedOptions(
                            item?.purchaseReturnAccountId ?? null,
                          ).map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.code} · {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {editing && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <FormLabel className="mb-0 text-sm">Active</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Inactive items are hidden from new transactions
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
                  {editing ? "Save changes" : "Create item"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
