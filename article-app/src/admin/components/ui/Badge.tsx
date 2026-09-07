type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "indigo";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/10",
  danger: "bg-red-50 text-red-700 ring-red-600/10",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
};

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
};

export default function Badge({ children, variant = "neutral", dot }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide rounded-full px-2.5 py-1 ring-1 ring-inset ${VARIANT_STYLES[variant]}`}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      {children}
    </span>
  );
}