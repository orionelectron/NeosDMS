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
import { categoryApi, type ItemCategory } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { categorySchema, type CategoryValues } from "@/lib/validation/trading";

const NO_PARENT = "none";

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ItemCategory | null;
}

export function CategoryFormSheet({
  open,
  onOpenChange,
  category,
}: CategoryFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(category);

  const { data: parentData } = useQuery({
    queryKey: queryKeys.trading.categoryList({ limit: 100 }),
    queryFn: () => categoryApi.list({ limit: 100 }),
  });

  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", code: "", parentCategoryId: NO_PARENT },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        category
          ? {
              name: category.name,
              code: category.code ?? "",
              parentCategoryId: category.parentCategoryId ?? NO_PARENT,
            }
          : { name: "", code: "", parentCategoryId: NO_PARENT },
      );
    }
  }, [open, category, form]);

  const parentOptions = (parentData?.data ?? []).filter(
    (option) => option.id !== category?.id,
  );

  const mutation = useMutation({
    mutationFn: (values: CategoryValues) => {
      const dto = {
        name: values.name,
        code: values.code === "" ? null : values.code,
        parentCategoryId:
          values.parentCategoryId === NO_PARENT
            ? null
            : values.parentCategoryId,
      };
      return category
        ? categoryApi.update(category.id, dto)
        : categoryApi.create(dto);
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated." : "Category created.");
      queryClient.invalidateQueries({ queryKey: ["trading", "categories"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the category."));
    },
  });

  function onSubmit(values: CategoryValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit category" : "New category"}</SheetTitle>
          <SheetDescription>
            Group items into a hierarchy for reporting and pricing.
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
                    <Input placeholder="e.g. Beverages" {...field} />
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
                    <Input placeholder="e.g. BEV" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional unique code for this category.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent category</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={parentOptions.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No parent category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>None</SelectItem>
                      {parentOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Optional — nest this category under another.
                  </FormDescription>
                  <FormMessage />
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
                {editing ? "Save changes" : "Create category"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
