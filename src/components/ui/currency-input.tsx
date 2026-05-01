"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatAmountInputDisplay, parseAmountInput } from "@/lib/format/currency-input";

export type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onValueChange: (raw: string) => void;
  /** When true (default), a zero amount shows as blank when not focused */
  emptyZero?: boolean;
};

function sanitizeTyping(s: string): string {
  const cleaned = s.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

export function CurrencyInput({
  value,
  onValueChange,
  emptyZero = true,
  className,
  onBlur,
  onFocus,
  ...rest
}: CurrencyInputProps) {
  const [focused, setFocused] = React.useState(false);

  const display = React.useMemo(() => {
    if (focused) return value;
    if (value.trim() === "") return "";
    const n = parseAmountInput(value);
    if (emptyZero && n === 0) return "";
    return formatAmountInputDisplay(n);
  }, [value, focused, emptyZero]);

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn("text-right tabular-nums", className)}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const n = parseAmountInput(value);
        if (emptyZero && n === 0) onValueChange("");
        else onValueChange(String(n));
        onBlur?.(e);
      }}
      onChange={(e) => onValueChange(sanitizeTyping(e.target.value))}
    />
  );
}
