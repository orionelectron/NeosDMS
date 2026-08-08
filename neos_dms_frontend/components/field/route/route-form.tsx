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
import { routeApi, type Route } from "@/lib/api/field";
import { routeSchema, type RouteValues } from "@/lib/validation/field";
import { districtsOfProvince, NEPAL_PROVINCES } from "@/lib/locations";

interface RouteFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: Route | null;
}

export function RouteFormSheet({
  open,
  onOpenChange,
  route,
}: RouteFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(route);

  const form = useForm<RouteValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      province: "",
      district: "",
      status: "ACTIVE",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        route
          ? {
              name: route.name,
              code: route.code,
              description: route.description ?? "",
              province: route.province ?? "",
              district: route.district ?? "",
              status: route.status,
            }
          : {
              name: "",
              code: "",
              description: "",
              province: "",
              district: "",
              status: "ACTIVE",
            },
      );
    }
  }, [open, route, form]);

  const mutation = useMutation({
    mutationFn: (values: RouteValues) => {
      const dto = {
        name: values.name,
        code: values.code,
        description: values.description || undefined,
        province: values.province || undefined,
        district: values.district || undefined,
        status: values.status,
      };
      return route ? routeApi.update(route.id, dto) : routeApi.create(dto);
    },
    onSuccess: () => {
      toast.success(editing ? "Route updated." : "Route created.");
      queryClient.invalidateQueries({ queryKey: ["field", "routes"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the route."));
    },
  });

  function onSubmit(values: RouteValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit route" : "New route"}</SheetTitle>
          <SheetDescription>
            A delivery route that outlets are linked to, then assigned to a
            salesperson.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Kathmandu East" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. KTM-EAST"
                        {...field}
                        disabled={editing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                          if (
                            value &&
                            !districtsOfProvince(value).includes(
                              form.getValues("district"),
                            )
                          ) {
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
              <RouteDistrict control={form.control} />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this route"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                {editing ? "Save changes" : "Create route"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

interface RouteDistrictProps {
  control: ReturnType<typeof useForm<RouteValues>>["control"];
}

function RouteDistrict({ control }: RouteDistrictProps) {
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
