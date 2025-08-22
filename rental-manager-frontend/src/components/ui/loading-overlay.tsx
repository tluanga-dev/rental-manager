import { cn } from "@/lib/utils"
import { Spinner } from "./spinner"

interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
  submessage?: string
  className?: string
}

export function LoadingOverlay({
  isVisible,
  message = "Processing...",
  submessage,
  className
}: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm",
        className
      )}
    >
      <div className="bg-white rounded-lg p-8 shadow-2xl max-w-sm w-full mx-4">
        <div className="text-center">
          {/* Spinner */}
          <div className="flex justify-center mb-4">
            <Spinner size="xl" variant="primary" />
          </div>
          
          {/* Main message */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {message}
          </h3>
          
          {/* Submessage */}
          {submessage && (
            <p className="text-sm text-gray-600">
              {submessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}