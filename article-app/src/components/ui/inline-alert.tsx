import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type InlineAlertVariant = "error" | "warning" | "success" | "info";

const VARIANT: Record<
  InlineAlertVariant,
  { className: string; Icon: typeof AlertCircle }
> = {
  error: {
    className: "border-red-200 bg-red-50 text-red-700",
    Icon: AlertCircle,
  },
  warning: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    Icon: TriangleAlert,
  },
  success: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: CheckCircle2,
  },
  info: {
    className: "border-teal-200 bg-teal-50 text-teal-800",
    Icon: Info,
  },
};

/** Shared inline fetch/error/status alert for list surfaces. */
export function InlineAlert({
  children,
  variant = "error",
  className,
  role = "alert",
}: {
  children: React.ReactNode;
  variant?: InlineAlertVariant;
  className?: string;
  role?: React.AriaRole;
}) {
  const { className: variantClass, Icon } = VARIANT[variant];
  return (
    <div
      role={role}
      className={cn(
        "mb-4 flex items-start gap-2 rounded-sm border px-4 py-3 text-sm",
        variantClass,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
