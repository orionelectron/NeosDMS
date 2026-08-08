"use client";

import * as React from "react";
import type { Control } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
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
import type { Account, Party } from "@/lib/api/accounting";
import type { JournalValues } from "@/lib/validation/accounting";

interface JournalLineEditorProps {
  index: number;
  control: Control<JournalValues>;
  accounts: Account[];
  parties: Party[];
  onRemove: () => void;
}

export function JournalLineEditor({
  index,
  control,
  accounts,
  parties,
  onRemove,
}: JournalLineEditorProps) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Line {index + 1}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
          Remove
        </Button>
      </div>
      <FormField
        control={control}
        name={`lines.${index}.accountId`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Account</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a leaf account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-72">
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code} — {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`lines.${index}.partyId`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Party (optional)</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-72">
                <SelectItem value="none">None</SelectItem>
                {parties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    {party.name}
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
          control={control}
          name={`lines.${index}.debit`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Debit</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="0.0000"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`lines.${index}.credit`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Credit</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="0.0000"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name={`lines.${index}.description`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Line note (optional)</FormLabel>
            <FormControl>
              <Input placeholder="e.g. rent for July" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
