import { ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TOOLTIP_MAX_LENGTH = 60;

/**
 * The stored link is rendered as an href, so only plain http(s) URLs are ever
 * used — the server already enforces this on write; this is the render-time
 * backstop so a bad value (e.g. javascript:) can never become a clickable link.
 */
export function getSafePublishedUrl(value?: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

/** "https://www.medium.com/x/y" -> "medium.com". Falls back to "Published". */
export function publishedLinkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "") || "Published";
  } catch {
    return "Published";
  }
}

export function truncateUrl(url: string, max = TOOLTIP_MAX_LENGTH): string {
  return url.length > max ? `${url.slice(0, max - 1)}…` : url;
}

/**
 * Table cell: an external-link icon (full URL, truncated, in the tooltip) or
 * "—" when there's no link. Stops propagation so clicking it doesn't also
 * trigger the row's own click (navigate to the article).
 */
export function PublishedLinkCell({ url }: { url?: string | null }) {
  const safeUrl = getSafePublishedUrl(url);

  if (!safeUrl) {
    return (
      <span className="flex min-h-7 items-center text-[13px] text-slate-700">
        —
      </span>
    );
  }

  const host = publishedLinkHost(safeUrl);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open published article on ${host}`}
            className={cn(
              "inline-flex rounded-md p-1.5 text-slate-500 transition-colors",
              "hover:bg-gray-200 hover:text-teal-600",
              "outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40",
            )}
          >
            <ExternalLink size={16} aria-hidden />
          </a>
        </TooltipTrigger>
        <TooltipContent>{truncateUrl(safeUrl)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
