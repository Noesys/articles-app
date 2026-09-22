export function getScoreColor(
  score: number,
  passThreshold: number | null,
  status: string,
) {
  if (status === "failed")
    return {
      text: "text-red-600",
      bar: "bg-red-500",
      barTw: "[&_[data-slot=progress-indicator]]:bg-red-600",
    };
  if (passThreshold !== null && passThreshold !== undefined) {
    if (score >= passThreshold)
      return {
        text: "text-emerald-600",
        bar: "bg-emerald-500",
        barTw: "[&_[data-slot=progress-indicator]]:bg-emerald-600",
      };
    if (score >= passThreshold * 0.7)
      return {
        text: "text-amber-600",
        bar: "bg-amber-500",
        barTw: "[&_[data-slot=progress-indicator]]:bg-amber-500",
      };
    return {
      text: "text-red-600",
      bar: "bg-red-500",
      barTw: "[&_[data-slot=progress-indicator]]:bg-red-600",
    };
  }
  // fallback status based
  if (status === "approved")
    return {
      text: "text-emerald-600",
      bar: "bg-emerald-500",
      barTw: "[&_[data-slot=progress-indicator]]:bg-emerald-600",
    };
  if (status === "rewrite_required")
    return {
      text: "text-red-600",
      bar: "bg-red-500",
      barTw: "[&_[data-slot=progress-indicator]]:bg-red-600",
    };
  return {
    text: "text-amber-600",
    bar: "bg-amber-500",
    barTw: "[&_[data-slot=progress-indicator]]:bg-amber-500",
  };
}

export function getDetailScoreColor(
  score: number,
  passThreshold: number | null,
  status: string,
) {
  const passed = passThreshold != null ? score >= passThreshold : status === "approved";
  return passed
    ? {
        text: "text-emerald-600",
        barTw: "[&_[data-slot=progress-indicator]]:bg-emerald-600",
      }
    : {
        text: "text-red-600",
        barTw: "[&_[data-slot=progress-indicator]]:bg-red-600",
      };
}

export function sanitizeFilename(title: string) {
  const base =
    title
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "article";
  return `${base}.md`;
}
