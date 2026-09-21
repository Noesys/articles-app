export type DiffPart = { type: "same" | "del" | "ins"; text: string };

const MAX_TOKENS = 700;

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/** Word-level diff (LCS). Falls back to whole-text del/ins for very long blocks. */
export function wordDiff(oldText: string, newText: string): DiffPart[] {
  const a = oldText.split(/(\s+)/).filter((t) => t !== "");
  const b = newText.split(/(\s+)/).filter((t) => t !== "");
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return [
      { type: "del", text: oldText },
      { type: "ins", text: newText },
    ];
  }

  const n = a.length;
  const m = b.length;
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("ins", b[j++]);
    }
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("ins", b[j++]);
  return parts;
}
