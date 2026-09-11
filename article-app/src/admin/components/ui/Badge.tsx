/**
 * Admin status Badge — Contiq semantic chips (success/warning/danger/neutral/indigo).
 * Prefer this for article-type status chips; use shadcn `components/ui/badge` for
 * DataGrid cells and generic outline/default badges. Both use rounded-sm.
 * Dual use is intentional: admin Badge carries semantic variants + optional dot.
 */
type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "indigo";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/10",
  danger: "bg-red-50 text-red-700 ring-red-600/10",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
  indigo: "bg-teal-50 text-teal-700 ring-teal-600/10",
};

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  /** Decorative; always pair with text label (never color-only). */
  dot?: boolean;
};

export default function Badge({ children, variant = "neutral", dot }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${VARIANT_STYLES[variant]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  );
}
