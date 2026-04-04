"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const normalizedValue = Math.min(Math.max(value ?? 0, 0), 100)

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        asChild
      >
        <svg
          aria-hidden="true"
          className="h-full w-full flex-1"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
        >
          <rect
            className="fill-primary transition-all"
            x="0"
            y="0"
            width={normalizedValue}
            height="1"
            rx="0.5"
            ry="0.5"
          />
        </svg>
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
