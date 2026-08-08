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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/http";
import { fiscalYearApi } from "@/lib/api/accounting";
import {
  fiscalYearSchema,
  type FiscalYearValues,
} from "@/lib/validation/accounting";

interface FiscalYearFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FiscalYearFormSheet({
  open,
  onOpenChange,
}: FiscalYearFormSheetProps) {
  const queryClient = useQueryClient();

  const form = useForm<FiscalYearValues>({
    resolver: zodResolver(fiscalYearSchema),
    defaultValues: { bsYear: "", name: "" },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ bsYear: "", name: "" });
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (values: FiscalYearValues) =>
      fiscalYearApi.create({
        bsYear: Number(values.bsYear),
        name: values.name === "" ? undefined : values.name,
      }),
    onSuccess: () => {
      toast.success("Fiscal year created with 12 periods.");
      queryClient.invalidateQueries({
        queryKey: ["accounting", "fiscal-years"],
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not create the fiscal year."));
    },
  });

  function onSubmit(values: FiscalYearValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New fiscal year</SheetTitle>
          <SheetDescription>
            Creates a fiscal year (BS) with its twelve periods. The first
            fiscal year is activated automatically.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <FormField
              control={form.control}
              name="bsYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BS year</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder="e.g. 2081"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The Nepali calendar year, e.g. 2081.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 2081/82 (optional)" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional — defaults to the standard year label.
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
                Create fiscal year
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
