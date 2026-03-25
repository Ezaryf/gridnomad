import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";


const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 hover:brightness-110 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 shrink-0",
  {
    variants: {
      variant: {
        default: "bg-white text-black hover:bg-white/90 shadow-[0_1px_0_rgba(255,255,255,0.18)]",
        secondary: "border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]",
        outline: "border border-white/12 bg-black text-zinc-100 hover:bg-white/[0.04]",
        ghost: "bg-transparent text-zinc-300 hover:bg-white/[0.06] hover:text-white",
        muted: "bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-5 text-sm",
        icon: "size-10 rounded-xl"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "default"
    }
  }
);


const Button = React.forwardRef(function Button(
  { className, variant, size, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});


export { Button, buttonVariants };
