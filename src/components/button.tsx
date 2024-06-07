import React from "react";
import { cn } from "../lib/utils";

export interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Button = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-base font-medium transition-all bg-zinc-900 hover:bg-zinc-700 text-zinc-100 h-10 py-2 px-3 border border-zinc-100",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };