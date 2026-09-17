export function stripTitleHash(t: string) {
  return t.replace(/^#\s*/, "").trim();
}

async function toDataUri(src: string): Promise<string> {
  if (!src || src.startsWith("data:")) return src;
  const url = /^https?:\/\//i.test(src)
    ? src
    : `${window.location.origin}${src.startsWith("/") ? "" : "/"}${src}`;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(url);
      r.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}

export async function buildExportMarkdown(
  title: string,
  content: string,
): Promise<string> {
  const cleanTitle = stripTitleHash(title);
  let body = content.trim().replace(/<p>\s*<\/p>/gi, "");
  if (/<img/i.test(body)) {
    const imgTags = [...body.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
    for (const tag of imgTags) {
      const rawSrc = tag.match(/src=["']([^"']+)["']/i)?.[1] ?? "";
      const dataSrc = await toDataUri(rawSrc);
      const alt = tag.match(/alt=["']([^"']*)["']/i)?.[1] ?? "";
      const width = tag.match(/width=["']([^"']+)["']/i)?.[1] ?? "";
      const style = tag.match(/style=["']([^"']+)["']/i)?.[1] ?? "";
      const align = tag.match(/data-align=["']([^"']+)["']/i)?.[1] ?? "";
      let mergedStyle = style;
      if (!/margin/i.test(style)) {
        if (align === "center")
          mergedStyle = [
            style,
            "display:block; margin-left:auto; margin-right:auto",
          ]
            .filter(Boolean)
            .join("; ");
        else if (align === "right")
          mergedStyle = [
            style,
            "display:block; margin-left:auto; margin-right:0",
          ]
            .filter(Boolean)
            .join("; ");
        else if (align === "left")
          mergedStyle = [
            style,
            "display:block; margin-left:0; margin-right:auto",
          ]
            .filter(Boolean)
            .join("; ");
      }
      const htmlAttrs = [
        `src="${dataSrc}"`,
        alt ? `alt="${alt}"` : "",
        width ? `width="${width}"` : "",
        mergedStyle ? `style="${mergedStyle}"` : "",
        align ? `data-align="${align}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const wrapperStyle =
        align === "center"
          ? "text-align:center"
          : align === "right"
            ? "text-align:right"
            : align === "left"
              ? "text-align:left"
              : "";
      const html = wrapperStyle
        ? `<div style="${wrapperStyle}"><img ${htmlAttrs} /></div>`
        : `<img ${htmlAttrs} />`;
      body = body.replace(tag, `\n\n${html}\n\n`);
    }
  }
  // An image never resized/aligned by the user serializes as plain Markdown
  // (`![alt](src)`, see serializeArticleContent.ts) rather than an <img> tag —
  // the pass above never touches these, so their `src` (a relative
  // `/api/images/...` URL, only resolvable inside the running app's own
  // origin) was left as-is, producing a dead link once copied/downloaded
  // outside the app. Inline them the same way as the <img> pass.
  if (/!\[[^\]]*\]\([^)]+\)/.test(body)) {
    const mdImageMatches = [
      ...body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g),
    ];
    for (const [fullMatch, alt, rawSrc] of mdImageMatches) {
      const dataSrc = await toDataUri(rawSrc);
      if (dataSrc === rawSrc) continue;
      body = body.replace(fullMatch, `![${alt}](${dataSrc})`);
    }
  }
  body = body.replace(/<\/p><p>/gi, "\n\n").replace(/\n{3,}/g, "\n\n");
  return `# ${cleanTitle}\n\n${body}`;
}
