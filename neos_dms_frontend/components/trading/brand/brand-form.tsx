"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { getErrorMessage } from "@/lib/api/http";
import { brandApi, type Brand } from "@/lib/api/trading";
import { brandSchema, type BrandValues } from "@/lib/validation/trading";

interface BrandFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: Brand | null;
}

export function BrandFormSheet({ open, onOpenChange, brand }: BrandFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(brand);

  const form = useForm<BrandValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(brand ? { name: brand.name } : { name: "" });
    }
  }, [open, brand, form]);

  const mutation = useMutation({
    mutationFn: (values: BrandValues) =>
      brand ? brandApi.update(brand.id, values) : brandApi.create(values),
    onSuccess: () => {
      toast.success(editing ? "Brand updated." : "Brand created.");
      queryClient.invalidateQueries({ queryKey: ["trading", "brands"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the brand."));
    },
  });

  function onSubmit(values: BrandValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit brand" : "New brand"}</SheetTitle>
          <SheetDescription>
            A brand you distribute, assigned to items as needed.
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
                    <Input placeholder="e.g. Acme" {...field} />
                  </FormControl>
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
                {editing ? "Save changes" : "Create brand"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
