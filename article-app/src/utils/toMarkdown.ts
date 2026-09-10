import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.addRule("table", {
  filter: "table",
  replacement: function (content) {
    return "\n" + content + "\n";
  },
});

turndown.addRule("tableHead", {
  filter: "thead",
  replacement: function (content) {
    return content;
  },
});

turndown.addRule("tableBody", {
  filter: "tbody",
  replacement: function (content) {
    return content;
  },
});

turndown.addRule("tableRow", {
  filter: "tr",
  replacement: function (content) {
    let line = "| " + content.trim() + " |";
    return line + "\n";
  },
});

turndown.addRule("tableCell", {
  filter: ["th", "td"],
  replacement: function (content) {
    return content.trim() + " | ";
  },
});

// Add IMAGE support to turndown - converts <img> to markdown ![alt](src)
turndown.addRule("image", {
  filter: "img",
  replacement: function (content, node) {
    const alt = node.getAttribute("alt") || "";
    const src = node.getAttribute("src") || "";
    return "![" + alt + "](" + src + ")";
  },
});

export function toMarkdown(content: string): string {
  if (!content.trim() || content.trim() === "<p></p>") return "";

  const temp = document.createElement("div");
  temp.innerHTML = content;

  const decode = (s: string) => {
    const ta = document.createElement("textarea");
    ta.innerHTML = s;
    return ta.value;
  };

  // Detect rich HTML (from .docx paste or Tiptap formatting) vs raw markdown wrapped in <p>
  const hasRichElements = !!temp.querySelector(
    "h1,h2,h3,ul,ol,blockquote,pre,table,strong,em,u",
  );
  const hasImages = !!temp.querySelector("img");
  const hasTable = !!temp.querySelector("table");

  // Case 1: Rich HTML (formatted docx / Tiptap tables/bold/headings/images) -> use Turndown
  if (hasRichElements || hasImages) {
    try {
      if (hasTable) {
        const div = document.createElement("div");
        div.innerHTML = content;

        // Fix tables that might have empty headers
        div.querySelectorAll("table").forEach((tbl) => {
          const headerRow = tbl.querySelector("thead tr");
          if (!headerRow || !headerRow.querySelector("th")) {
            const firstBodyRow = tbl.querySelector("tbody tr");
            if (firstBodyRow) {
              const thead = document.createElement("thead");
              const headerTr = document.createElement("tr");

              firstBodyRow.querySelectorAll("td").forEach((td) => {
                const th = document.createElement("th");
                th.innerHTML = td.innerHTML;
                headerTr.appendChild(th);
              });

              thead.appendChild(headerTr);

              const tbody = tbl.querySelector("tbody");
              if (tbody) {
                tbl.insertBefore(thead, tbody);
                firstBodyRow.remove();
              }
            }
          }
        });

        content = div.innerHTML;
      }

      let md = turndown.turndown(content);
      md = decode(md);

      md = md
        .split("\n")
        .map((line) => {
          if (line.includes("|")) return line;
          return line.replace(/\\([#*_\-[\]`>])/g, "$1");
        })
        .join("\n");

      // Fix GFM table format: ensure delimiter row immediately follows header
      md = md.replace(
        /(\|[^\n]*\|)\n\s*\n\s*(\|[\s\-:|]+\|)/g,
        "$1\n$2",
      );

      // Collapse multiple blank lines inside table blocks
      md = md.replace(/(\|[^\n]*\|)\n\n(?=\|)/g, "$1\n");

      // Ensure proper spacing between table and other content
      md = md.replace(/(\|[\s\-:|]+\|)\n(?!\|)/g, "$1\n\n");

      // Clean up multiple consecutive blank lines (except in tables)
      md = md.replace(/\n\n\n+/g, "\n\n");

      return md.trim();
    } catch (e) {
      console.error("Turndown error:", e);
      /* fallthrough */
    }
  }

  // Case 2: raw markdown pasted (wrapped in <p>) + optional images
  const getTextWithBreaks = (el: HTMLElement): string => {
    const clone = el.cloneNode(true) as HTMLElement;

    clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));

    return decode((clone.textContent ?? "").trim());
  };

  const parts: string[] = [];

  for (const node of Array.from(temp.childNodes) as ChildNode[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const tx = decode((node.textContent ?? "").trim());

      if (tx) parts.push(tx);
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const el = node as HTMLElement;

    if (el.tagName.toLowerCase() === "img") {
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";

      if (src) parts.push("![" + alt + "](" + src + ")");
      continue;
    }

    const imgs = Array.from(el.querySelectorAll("img"));

    if (imgs.length > 0) {
      const clone = el.cloneNode(true) as HTMLElement;

      clone.querySelectorAll("img").forEach((n) => n.remove());
      clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));

      const text = decode((clone.textContent ?? "").trim());

      if (text) parts.push(text);

      for (const img of imgs) {
        const src =
          (img as HTMLImageElement).getAttribute("src") ?? "";
        const alt = img.getAttribute("alt") ?? "";

        if (src) parts.push("![" + alt + "](" + src + ")");
      }

      continue;
    }

    const text = getTextWithBreaks(el);

    if (!text) continue;

    if (text.includes("|") && text.includes("\n")) {
      parts.push(text);
    } else {
      parts.push(text);
    }
  }

  if (parts.length > 0) {
    let out = parts.join("\n\n").trim();

    // GFM tables must have header and delimiter on consecutive lines
    out = out.replace(/(\|[^\n]*\|)\n\s*\n(?=\|)/g, "$1\n");

    return out;
  }

  // Fallback: images at deeper nesting or Turndown for edge cases
  if (hasImages) {
    try {
      return decode(turndown.turndown(content)).trim();
    } catch {}
  }

  const raw = decode(
    (temp as HTMLElement).innerText ?? temp.textContent ?? "",
  );

  return raw.trim();
}