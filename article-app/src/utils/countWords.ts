export function countWords(html: string): number {
  if (!html || html.trim() === "" || html.trim() === "<p></p>") return 0;
  // Use DOM to strip HTML properly for formatted/pasted content
  const el = document.createElement("div");
  el.innerHTML = html;
  const text = (el.textContent ?? el.innerText ?? "").trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
