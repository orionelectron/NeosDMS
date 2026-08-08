"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  emptyText = "No matching options.",
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [focusIndex, setFocusIndex] = React.useState(0);

  const selected = options.find((option) => option.value === value);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        option.value.toLowerCase().includes(term),
    );
  }, [options, search]);

  function select(option: ComboboxOption) {
    onValueChange(option.value);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          {selected && (
            <button
              type="button"
              aria-label="Clear selection"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onValueChange("");
                setSearch("");
              }}
              className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setFocusIndex(0);
            }}
            placeholder="Search…"
            className="border-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>
        <div
          role="listbox"
          className="max-h-64 overflow-y-auto p-1"
          onKeyDown={(event) => {
            if (filtered.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setFocusIndex((index) => (index + 1) % filtered.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setFocusIndex(
                (index) => (index - 1 + filtered.length) % filtered.length,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              select(filtered[focusIndex]);
            }
          }}
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setFocusIndex(index)}
                  onClick={() => select(option)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                    index === focusIndex && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                  {isSelected && (
                    <Check className="size-4 shrink-0" aria-hidden />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
