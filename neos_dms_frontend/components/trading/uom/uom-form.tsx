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
import { uomApi, type Uom } from "@/lib/api/trading";
import { uomSchema, type UomValues } from "@/lib/validation/trading";

interface UomFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uom: Uom | null;
}

export function UomFormSheet({ open, onOpenChange, uom }: UomFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(uom);

  const form = useForm<UomValues>({
    resolver: zodResolver(uomSchema),
    defaultValues: { name: "", shortName: "" },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        uom ? { name: uom.name, shortName: uom.shortName } : { name: "", shortName: "" },
      );
    }
  }, [open, uom, form]);

  const mutation = useMutation({
    mutationFn: (values: UomValues) =>
      uom ? uomApi.update(uom.id, values) : uomApi.create(values),
    onSuccess: () => {
      toast.success(editing ? "Unit updated." : "Unit created.");
      queryClient.invalidateQueries({ queryKey: ["trading", "uoms"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the unit."));
    },
  });

  function onSubmit(values: UomValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit unit" : "New unit"}</SheetTitle>
          <SheetDescription>
            A unit of measure used across the system, e.g. case, box or piece.
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
                    <Input placeholder="e.g. Case" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shortName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CS" {...field} />
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
                {editing ? "Save changes" : "Create unit"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
