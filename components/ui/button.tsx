"use client";
import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-ocean text-white hover:bg-ocean-600",
        success: "bg-ok text-white hover:bg-ok-600",
        outline: "border border-navy/20 bg-white/60 text-navy hover:bg-white",
        ghost: "text-navy hover:bg-navy/5",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-10 px-3 text-sm",
        md: "h-12 px-5 text-base",
        lg: "h-14 px-6 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", loading, disabled, children, ...props }, ref) => {
    // Submit buttons spin automatically while their parent form's server action runs.
    const { pending } = useFormStatus();
    const busy = !!loading || (type === "submit" && pending);
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        {...props}
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
