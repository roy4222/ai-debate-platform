import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-base text-white shadow-sm transition-all duration-200",
        "placeholder:text-slate-500",
        "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-100",
        className
      )}
      {...props}
    />
  );
}

export { Input };
