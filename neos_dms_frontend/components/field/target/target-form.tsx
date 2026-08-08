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
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/http";
import { userApi } from "@/lib/api/iam";
import { categoryApi, brandApi } from "@/lib/api/trading";
import { salesTargetApi } from "@/lib/api/field";
import { queryKeys } from "@/lib/query/keys";
import {
  salesTargetSchema,
  type SalesTargetValues,
} from "@/lib/validation/field";

const NO_SELECT = "none";

interface SalesTargetFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SalesTargetFormSheet({
  open,
  onOpenChange,
}: SalesTargetFormSheetProps) {
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: queryKeys.iam.userList({ page: 1, limit: 100 }),
    queryFn: () => userApi.list({ page: 1, limit: 100 }),
    enabled: open,
  });

  const { data: categories } = useQuery({
    queryKey: queryKeys.trading.categoryList({ page: 1, limit: 100 }),
    queryFn: () => categoryApi.list({ page: 1, limit: 100 }),
    enabled: open,
  });

  const { data: brands } = useQuery({
    queryKey: queryKeys.trading.brandList({ page: 1, limit: 100 }),
    queryFn: () => brandApi.list({ page: 1, limit: 100 }),
    enabled: open,
  });

  const form = useForm<SalesTargetValues>({
    resolver: zodResolver(salesTargetSchema),
    defaultValues: {
      userId: "",
      bsYear: "",
      bsMonth: "",
      targetType: "PERSONAL",
      categoryId: "",
      brandId: "",
      amount: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        userId: "",
        bsYear: "",
        bsMonth: "",
        targetType: "PERSONAL",
        categoryId: "",
        brandId: "",
        amount: "",
      });
    }
  }, [open, form]);

  const targetType = useWatch({ control: form.control, name: "targetType" });

  const mutation = useMutation({
    mutationFn: (values: SalesTargetValues) => {
      const dto = {
        userId: values.userId,
        bsYear: Number(values.bsYear),
        bsMonth: Number(values.bsMonth),
        targetType: values.targetType,
        categoryId:
          values.targetType === "CATEGORY" && values.categoryId
            ? values.categoryId
            : undefined,
        brandId:
          values.targetType === "BRAND" && values.brandId
            ? values.brandId
            : undefined,
        amount: Number(values.amount),
      };
      return salesTargetApi.create(dto);
    },
    onSuccess: () => {
      toast.success("Target set.");
      queryClient.invalidateQueries({ queryKey: ["field", "targets"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the target."));
    },
  });

  function onSubmit(values: SalesTargetValues) {
    mutation.mutate(values);
  }

  const activeUsers = (users?.data ?? []).filter((user) => user.isActive);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Set a sales target</SheetTitle>
          <SheetDescription>
            A monthly sales target for a salesperson. It can cover their whole
            personal sales, a product category, or a brand.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salesperson</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a salesperson" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bsYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BS year</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="2082" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bsMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BS month</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="1–12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="targetType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target scope</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PERSONAL">Personal</SelectItem>
                      <SelectItem value="CATEGORY">Category</SelectItem>
                      <SelectItem value="BRAND">Brand</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {targetType === "CATEGORY" && (
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value || NO_SELECT}
                      onValueChange={(value) =>
                        field.onChange(value === NO_SELECT ? "" : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(categories?.data ?? []).map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {targetType === "BRAND" && (
              <FormField
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <Select
                      value={field.value || NO_SELECT}
                      onValueChange={(value) =>
                        field.onChange(value === NO_SELECT ? "" : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a brand" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(brands?.data ?? []).map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (NPR)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="0.00" {...field} />
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
                Set target
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
