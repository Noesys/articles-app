"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-600" />,
        info: <InfoIcon className="size-4 text-teal-600" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-600" />,
        error: <OctagonXIcon className="size-4 text-red-600" />,
        loading: <Loader2Icon className="size-4 animate-spin text-slate-500" />,
      }}
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#0f172a",
          "--normal-border": "#e2e8f0",
          "--success-bg": "#ecfdf5",
          "--success-border": "#a7f3d0",
          "--success-text": "#047857",
          "--error-bg": "#fef2f2",
          "--error-border": "#fecaca",
          "--error-text": "#b91c1c",
          "--border-radius": "0.375rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast rounded-sm border border-slate-200 bg-white text-slate-900 shadow-[var(--shadow-overlay)]",
          success: "border-emerald-200 bg-emerald-50",
          error: "border-red-200 bg-red-50",
          warning: "border-amber-200 bg-amber-50",
          info: "border-teal-200 bg-teal-50",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
