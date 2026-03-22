import * as React from "react";

import { cn } from "@/lib/utils";


const Input = React.forwardRef(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-white/10 bg-white/3 px-3 py-2 text-sm text-zinc-50 shadow-sm outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-white/20 focus-visible:bg-white/5 focus-visible:ring-1 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});


export { Input };
