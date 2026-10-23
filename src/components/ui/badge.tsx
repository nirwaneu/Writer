import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-muted-foreground",
        amber: "border-[#5b431c] bg-[#241a0b] text-[#f2c477]",
        success: "border-[#2d4a36] bg-[#14211a] text-[#9cc9a6]",
        danger: "border-[#5a2c25] bg-[#241411] text-[#f2937f]",
        paper: "border-[#d6c9b2] bg-[#ebe1ce] text-[#6a5d49]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
