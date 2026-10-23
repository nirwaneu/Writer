"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { parseModelValue } from "@/lib/ai/routing";
import type { ModelOption, ProviderModelGroup } from "@/lib/ai/model-options";
import { cn } from "@/lib/utils";

export function ModelCombobox({
  id,
  value,
  onChange,
  groups,
  options,
  loading = false,
  error,
  disabled = false,
  placeholder = "Choose a model?",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  groups: ProviderModelGroup[];
  options: ModelOption[];
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const parsed = parseModelValue(value);
  const providerHint = options.find((option) => option.providerId === parsed.providerId);
  const currentLabel = selected?.label
    ?? (parsed.model
      ? providerHint
        ? `[${providerHint.providerName}] ${parsed.model}`
        : parsed.model
      : "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 w-full justify-between px-3 font-normal", className)}
        >
          <span className={cn("truncate text-left text-[12.5px]", !currentLabel && "text-muted-foreground")}>
            {currentLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[280px] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search models across providers?" />
          <CommandList>
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Reading models from providers?
              </div>
            ) : null}
            {error ? (
              <div className="px-3 py-3 text-[11.5px] leading-relaxed text-[#f2937f]">{error}</div>
            ) : null}
            <CommandEmpty>No models found. Add or test a provider connection.</CommandEmpty>

            {value && !selected ? (
              <CommandGroup heading="Current">
                <CommandItem
                  value={value}
                  keywords={[currentLabel, parsed.model]}
                  onSelect={() => {
                    onChange(value);
                    setOpen(false);
                  }}
                >
                  <Check className="text-primary" />
                  <span className="truncate">{currentLabel}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}

            {groups.map((group) => (
              <CommandGroup key={group.providerId} heading={group.providerName}>
                {group.error ? (
                  <p className="px-2 py-1.5 text-[10.5px] leading-relaxed text-[#f2937f]">
                    {group.error}
                  </p>
                ) : null}
                {group.models.map((model) => {
                  const optionValue = `${group.providerId}|${model}`;
                  return (
                    <CommandItem
                      key={optionValue}
                      value={optionValue}
                      keywords={[group.providerName, model, `[${group.providerName}] ${model}`]}
                      onSelect={() => {
                        onChange(optionValue);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "shrink-0",
                          value === optionValue ? "opacity-100 text-primary" : "opacity-0",
                        )}
                      />
                      <span className="truncate">
                        <span className="text-muted-foreground">[{group.providerName}]</span>{" "}
                        {model}
                      </span>
                    </CommandItem>
                  );
                })}
                {!group.error && !group.models.length ? (
                  <p className="px-2 py-1 text-[10.5px] text-muted-foreground">
                    No models listed.
                  </p>
                ) : null}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
