import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.22)_inset] hover:bg-[#ffbb55]",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:border-[#35465a] hover:bg-[#1d2834]",
        outline:
          "border border-border bg-transparent text-foreground hover:border-[#3a4a5b] hover:bg-white/[0.035]",
        ghost: "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[#ff8570] focus-visible:ring-destructive",
        link: "text-primary underline-offset-4 hover:underline",
        paper:
          "bg-[#1a1712] text-[#f5eedf] hover:bg-[#2c261c] focus-visible:ring-[#a86412] focus-visible:ring-offset-[#f5eedf]",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 rounded-[5px] px-2.5 text-[13px]",
        lg: "h-10 px-5",
        icon: "size-9",
        "icon-sm": "size-8 rounded-[5px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
