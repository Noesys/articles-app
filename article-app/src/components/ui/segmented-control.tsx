import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: Option<T>[];
  className?: string;
  "aria-label"?: string;
};

/**
 * "Pick one of a few views" control: every choice is always visible and the
 * active one is highlighted, so the current state is never ambiguous (unlike a
 * button whose label flips to describe the action it would take). A segment
 * can't be deselected — clicking the active one is a no-op.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-9 items-center rounded-sm border border-border bg-white p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "inline-flex h-full flex-1 cursor-pointer items-center justify-center rounded-[3px] px-3 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors outline-none",
            "hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-500/40",
            "data-[state=on]:bg-teal-600 data-[state=on]:text-white data-[state=on]:hover:bg-teal-600",
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
