"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import {
  branchApi,
  partyApi,
  PARTY_KINDS,
  type Party,
} from "@/lib/api/accounting";
import {
  partySchema,
  PARTY_ADDRESS_TYPES,
  type PartyAddressValues,
  type PartyValues,
} from "@/lib/validation/accounting";

const NO_BRANCH = "none";

const PARTY_KIND_LABELS: Record<string, string> = {
  BUSINESS: "Business",
  INDIVIDUAL: "Individual",
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

interface PartyFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  party: Party | null;
}

export function PartyFormSheet({
  open,
  onOpenChange,
  party,
}: PartyFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(party);

  const { data: branchData } = useQuery({
    queryKey: ["accounting", "branches"],
    queryFn: () => branchApi.list(),
  });

  const form = useForm<PartyValues>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      name: "",
      partyKind: "BUSINESS",
      isCustomer: false,
      isSupplier: false,
      isLead: false,
      panNumber: "",
      vatNumber: "",
      email: "",
      phone: "",
      address: "",
      creditLimit: "",
      openingBalance: "",
      branchId: NO_BRANCH,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        party
          ? {
              name: party.name,
              partyKind: party.partyKind,
              isCustomer: party.isCustomer,
              isSupplier: party.isSupplier,
              isLead: party.isLead,
              panNumber: party.panNumber ?? "",
              vatNumber: party.vatNumber ?? "",
              email: party.email ?? "",
              phone: party.phone ?? "",
              address: party.address ?? "",
              creditLimit: party.creditLimit,
              openingBalance: party.openingBalance,
              branchId: party.branchId ?? NO_BRANCH,
            }
          : {
              name: "",
              partyKind: "BUSINESS",
              isCustomer: false,
              isSupplier: false,
              isLead: false,
              panNumber: "",
              vatNumber: "",
              email: "",
              phone: "",
              address: "",
              creditLimit: "",
              openingBalance: "",
              branchId: NO_BRANCH,
            },
      );
      if (!party) {
        form.setValue("addresses", []);
      }
    }
  }, [open, party, form]);

  const branches = branchData ?? [];

  const mutation = useMutation({
    mutationFn: (values: PartyValues) => {
      const base = {
        name: values.name,
        partyKind: values.partyKind,
        isCustomer: values.isCustomer,
        isSupplier: values.isSupplier,
        isLead: values.isLead,
        panNumber: values.panNumber === "" ? null : values.panNumber,
        vatNumber: values.vatNumber === "" ? null : values.vatNumber,
        email: values.email === "" ? null : values.email,
        phone: values.phone === "" ? null : values.phone,
        address: values.address === "" ? null : values.address,
        creditLimit:
          values.creditLimit === "" ? undefined : Number(values.creditLimit),
        openingBalance:
          values.openingBalance === "" ? undefined : Number(values.openingBalance),
        branchId:
          values.branchId === NO_BRANCH ? null : values.branchId,
      };
      if (party) {
        return partyApi.update(party.id, base);
      }
      const addresses: PartyAddressValues[] = values.addresses ?? [];
      return partyApi.create({
        ...base,
        addresses: addresses.map((address) => ({
          addressType: address.addressType,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2 === "" ? null : address.addressLine2,
          city: address.city === "" ? null : address.city,
          isDefault: address.isDefault,
        })),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Party updated." : "Party created.");
      queryClient.invalidateQueries({ queryKey: ["accounting", "parties"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the party."));
    },
  });

  function onSubmit(values: PartyValues) {
    mutation.mutate(values);
  }

  const roleError = form.formState.errors.isCustomer?.message;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit party" : "New party"}</SheetTitle>
          <SheetDescription>
            Customers, suppliers and leads used across sales and purchases.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Himalayan Traders"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partyKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PARTY_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {PARTY_KIND_LABELS[kind] ?? kind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SectionTitle>Role</SectionTitle>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="isCustomer"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center gap-2 rounded-lg border p-3">
                      <FormLabel className="mb-0 text-xs">
                        Customer
                      </FormLabel>
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
                  name="isSupplier"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center gap-2 rounded-lg border p-3">
                      <FormLabel className="mb-0 text-xs">
                        Supplier
                      </FormLabel>
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
                  name="isLead"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center gap-2 rounded-lg border p-3">
                      <FormLabel className="mb-0 text-xs">Lead</FormLabel>
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
              {roleError && (
                <p className="text-xs font-medium text-destructive">
                  {roleError}
                </p>
              )}
            </div>

            <SectionTitle>Contact</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="panNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PAN</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 302345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 400123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 98XXXXXXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. hello@acme.com"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. New Road, Kathmandu"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={branches.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No branch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_BRANCH}>None</SelectItem>
                        {branches.map((branch) => (
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
            </div>

            <SectionTitle>Accounting</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="creditLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit limit (NPR)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openingBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening balance (NPR)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!editing && (
              <div className="space-y-2">
                <SectionTitle>Addresses</SectionTitle>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Billing and shipping addresses (optional).
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        addressType: "Billing",
                        addressLine1: "",
                        addressLine2: "",
                        city: "",
                        isDefault: false,
                      })
                    }
                  >
                    <Plus className="size-4" aria-hidden />
                    Add address
                  </Button>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Address {index + 1}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove address"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.addressType`}
                        render={({ field: subField }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select
                              value={subField.value}
                              onValueChange={subField.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PARTY_ADDRESS_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
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
                        name={`addresses.${index}.isDefault`}
                        render={({ field: subField }) => (
                          <FormItem className="flex items-center justify-between gap-2 pt-6">
                            <FormLabel>Default</FormLabel>
                            <FormControl>
                              <Switch
                                checked={subField.value}
                                onCheckedChange={subField.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.addressLine1`}
                        render={({ field: subField }) => (
                          <FormItem>
                            <FormLabel>Line 1</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Ward 4, New Road"
                                {...subField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.addressLine2`}
                        render={({ field: subField }) => (
                          <FormItem>
                            <FormLabel>Line 2</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 2nd floor"
                                {...subField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`addresses.${index}.city`}
                      render={({ field: subField }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Kathmandu" {...subField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
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
                  {editing ? "Save changes" : "Create party"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
