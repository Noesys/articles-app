import { useState, useMemo, useRef, useEffect, KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type FilterSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  searchable?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
};

export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  triggerClassName,
  searchable = true,
  disabled = false,
  "aria-label": ariaLabel,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) {
      setHighlight(0);
      return;
    }
    const idx = filtered.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, filtered, value]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const selectOption = (opt: Option) => {
    onValueChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  const handleOpenChange = (next: boolean) => {
    if (disabled) return;
    setOpen(next);
    if (!next) setQuery("");
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) selectOption(opt);
    }
  };

  return (
    <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-disabled={disabled}
          aria-expanded={open && !disabled}
          aria-haspopup="listbox"
          aria-label={ariaLabel ?? placeholder}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-1.5 rounded-sm border border-input bg-white px-2.5 text-sm shadow-none outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
            disabled && "cursor-not-allowed opacity-50",
            triggerClassName,
            className,
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={8}
        className="w-[--radix-popover-trigger-width] p-0 overflow-hidden bg-white"
        onKeyDown={onListKeyDown}
      >
        {searchable && (
          <div className="flex items-center gap-2 border-b px-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              placeholder="Search..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onListKeyDown}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div ref={listRef} role="listbox" className="max-h-[200px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">No results</p>
          ) : (
            filtered.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                data-idx={idx}
                aria-selected={value === opt.value}
                onClick={() => selectOption(opt)}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  (value === opt.value || highlight === idx) &&
                    "bg-accent text-accent-foreground",
                )}
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.value && <Check className="size-4 shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
