"use client";

import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

type ActionButtonProps = ButtonProps & {
  /** When true, disables the button and shows a spinner + loading label. */
  loading?: boolean;
  loadingText?: string;
};

/** Primary/async action button — spinner, disabled state, and aria-busy while loading. */
export function ActionButton({
  loading = false,
  loadingText = "Inaendelea…",
  disabled,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <Button disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Form submit button with the same loading UX as ActionButton. */
export function SubmitButton({
  loading = false,
  loadingText = "Inaendelea…",
  disabled,
  children,
  type = "submit",
  ...props
}: ActionButtonProps) {
  return (
    <ActionButton
      type={type}
      loading={loading}
      loadingText={loadingText}
      disabled={disabled}
      {...props}
    >
      {children}
    </ActionButton>
  );
}
