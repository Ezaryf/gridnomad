import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";


const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 text-[10px] font-medium uppercase tracking-[0.16em]",
  {
    variants: {
      variant: {
        default: "border-white/12 bg-white/[0.05] text-zinc-300",
        solid: "border-white/10 bg-white text-black",
        muted: "border-white/8 bg-white/[0.03] text-zinc-400"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);


function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}


export { Badge };
