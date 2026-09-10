import { cn } from "@/lib/utils";

/** Consistent page padding via Contiq layout tokens. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full px-[var(--page-pad-x)] py-[var(--page-pad-y)] md:px-[var(--page-pad-x-md)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Left-aligned page title + optional subtitle/count + actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-[var(--section-gap)] flex items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Cohesive filter / toolbar row. */
export function FilterToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-[var(--section-gap)] flex flex-wrap items-center gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
