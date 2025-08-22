import { cn } from "@/lib/utils"
import { VariantProps, cva } from "class-variance-authority"

const spinnerVariants = cva(
  "animate-spin rounded-full border-solid border-t-transparent",
  {
    variants: {
      size: {
        sm: "h-4 w-4 border-2",
        md: "h-6 w-6 border-2",
        lg: "h-8 w-8 border-3",
        xl: "h-12 w-12 border-4",
      },
      variant: {
        default: "border-gray-300 border-t-gray-600",
        primary: "border-blue-200 border-t-blue-600",
        white: "border-gray-300 border-t-white",
        success: "border-green-200 border-t-green-600",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {}

const Spinner = ({ className, size, variant, ...props }: SpinnerProps) => {
  return (
    <div
      className={cn(spinnerVariants({ size, variant, className }))}
      {...props}
    />
  )
}

Spinner.displayName = "Spinner"

export { Spinner, spinnerVariants }