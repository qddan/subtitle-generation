import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        pending: "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        processing: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 animate-pulse-slow",
        done: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
        error: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
