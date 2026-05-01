"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Info icon before the title; explanatory copy opens in a dialog. */
export function SectionTitleWithInfo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`About ${title}`}
          >
            <Info className="h-4 w-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
        </DialogContent>
      </Dialog>
      <CardTitle className="text-lg">{title}</CardTitle>
    </div>
  );
}
