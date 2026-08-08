"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/http";
import {
  OUTLET_CHANNELS,
  outletApi,
  type Outlet,
  type OutletChannel,
} from "@/lib/api/field";
import { outletSchema, type OutletValues } from "@/lib/validation/field";
import {
  districtsOfProvince,
  NEPAL_PROVINCES,
} from "@/lib/locations";

const CHANNEL_LABELS: Record<OutletChannel, string> = {
  GENERAL_TRADE: "General trade",
  MODERN_TRADE: "Modern trade",
  HORECA: "HORECA",
  INSTITUTION: "Institution",
};

interface OutletFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlet: Outlet | null;
}

export function OutletFormSheet({
  open,
  onOpenChange,
  outlet,
}: OutletFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(outlet);

  const form = useForm<OutletValues>({
    resolver: zodResolver(outletSchema),
    defaultValues: {
      name: "",
      ownerName: "",
      email: "",
      phone: "",
      address: "",
      province: "",
      district: "",
      latitude: "",
      longitude: "",
      channel: "GENERAL_TRADE",
      category: "",
      description: "",
      status: "ACTIVE",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        outlet
          ? {
              name: outlet.name,
              ownerName: outlet.ownerName ?? "",
              email: outlet.email ?? "",
              phone: outlet.phone ?? "",
              address: outlet.address ?? "",
              province: outlet.province ?? "",
              district: outlet.district ?? "",
              latitude: outlet.latitude ?? "",
              longitude: outlet.longitude ?? "",
              channel: outlet.channel,
              category: outlet.category ?? "",
              description: outlet.description ?? "",
              status: outlet.status,
            }
          : {
              name: "",
              ownerName: "",
              email: "",
              phone: "",
              address: "",
              province: "",
              district: "",
              latitude: "",
              longitude: "",
              channel: "GENERAL_TRADE",
              category: "",
              description: "",
              status: "ACTIVE",
            },
      );
    }
  }, [open, outlet, form]);

  const mutation = useMutation({
    mutationFn: (values: OutletValues) => {
      const dto = {
        name: values.name,
        ownerName: values.ownerName || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        province: values.province || undefined,
        district: values.district || undefined,
        latitude:
          values.latitude === "" ? undefined : Number(values.latitude),
        longitude:
          values.longitude === "" ? undefined : Number(values.longitude),
        channel: values.channel,
        category: values.category || undefined,
        description: values.description || undefined,
        status: values.status,
      };
      return outlet
        ? outletApi.update(outlet.id, dto)
        : outletApi.create(dto);
    },
    onSuccess: () => {
      toast.success(editing ? "Outlet updated." : "Outlet created.");
      queryClient.invalidateQueries({ queryKey: ["field", "outlets"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the outlet."));
    },
  });

  function onSubmit(values: OutletValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit outlet" : "New outlet"}</SheetTitle>
          <SheetDescription>
            A customer-facing sales point. Creating one also provisions an
            accounting customer party.
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
                    <Input placeholder="e.g. Shree Kirana Store" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OUTLET_CHANNELS.map((channel) => (
                          <SelectItem key={channel} value={channel}>
                            {CHANNEL_LABELS[channel]}
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Kirana" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner</FormLabel>
                    <FormControl>
                      <Input placeholder="Owner name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 9841XXXXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="owner@example.com" {...field} />
                  </FormControl>
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
                    <Input placeholder="Street, area" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          if (value && !districtsOfProvince(value).includes(form.getValues("district"))) {
                            form.setValue("district", "");
                          }
                        }}
                        options={NEPAL_PROVINCES.map((province) => ({
                          value: province.name,
                          label: province.name,
                        }))}
                        placeholder="Select province"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ProvinceDistricts control={form.control} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 27.7172" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 85.3240" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {editing && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this outlet"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
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
                {editing ? "Save changes" : "Create outlet"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

interface ProvinceDistrictsProps {
  control: ReturnType<typeof useForm<OutletValues>>["control"];
}

function ProvinceDistricts({ control }: ProvinceDistrictsProps) {
  const province = useWatch({ control, name: "province" });
  const options = React.useMemo(() => {
    const districts = province ? districtsOfProvince(province) : [];
    return districts.map((name) => ({ value: name, label: name }));
  }, [province]);

  return (
    <FormField
      control={control}
      name="district"
      render={({ field }) => (
        <FormItem>
          <FormLabel>District</FormLabel>
          <FormControl>
            <Combobox
              value={field.value}
              onValueChange={field.onChange}
              options={options}
              placeholder={
                province ? "Select district" : "Select province first"
              }
              disabled={!province}
              emptyText="No districts for this province."
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
