import { Download } from "lucide-react";

type DownloadMarkdownButtonProps = {
  title: string;
  content: string;
  filename?: string;
};

export function DownloadMarkdownButton({
  title,
  content,
  filename = "document.md",
}: DownloadMarkdownButtonProps) {
  const handleDownload = async () => {
    let body = content.trim().replace(/<p>\s*<\/p>/gi, "");
    if (/<img/i.test(body)) {
      const toDataUri = async (src: string): Promise<string> => {
        if (!src || src.startsWith("data:")) return src;
        const url = /^https?:\/\//i.test(src) ? src : `${window.location.origin}${src.startsWith("/") ? "" : "/"}${src}`;
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
          return url;
        }
      };
      const imgTags = [...body.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
      for (const tag of imgTags) {
        const srcM = tag.match(/src=["']([^"']+)["']/i);
        const rawSrc = srcM?.[1] ?? "";
        const dataSrc = await toDataUri(rawSrc);
        const altM = tag.match(/alt=["']([^"']*)["']/i);
        const alt = altM?.[1] ?? "";
        const widthM = tag.match(/width=["']([^"']+)["']/i);
        const width = widthM?.[1] ?? "";
        const styleM = tag.match(/style=["']([^"']+)["']/i);
        const style = styleM?.[1] ?? "";
        const alignM = tag.match(/data-align=["']([^"']+)["']/i);
        const align = alignM?.[1] ?? "";
        // Use HTML <img> with data URI + width/style/align so both in-app (rehype-raw)
        // and external VS Code/GitHub previews retain sizing/alignment; markdown ![alt](data:)
        // alone would discard sizing.
        // Merge existing style (already contains width) with alignment margins so
        // external previewers (VS Code, GitHub) honor left/center/right without needing data-align.
        let mergedStyle = style;
        const styleHasMargin = /margin/i.test(style);
        if (!styleHasMargin) {
          if (align === "center") mergedStyle = [style, "display:block; margin-left:auto; margin-right:auto"].filter(Boolean).join("; ");
          else if (align === "right") mergedStyle = [style, "display:block; margin-left:auto; margin-right:0"].filter(Boolean).join("; ");
          else if (align === "left") mergedStyle = [style, "display:block; margin-left:0; margin-right:auto"].filter(Boolean).join("; ");
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
        // Wrap in a div with text-align for previewers that strip margin:auto on <img>
        const wrapperStyle =
          align === "center" ? "text-align:center" : align === "right" ? "text-align:right" : align === "left" ? "text-align:left" : "";
        const html = wrapperStyle
          ? `<div style="${wrapperStyle}"><img ${htmlAttrs} /></div>`
          : `<img ${htmlAttrs} />`;
        body = body.replace(tag, `\n\n${html}\n\n`);
      }
    }
    body = body.replace(/<\/p><p>/gi, "\n\n").replace(/\n{3,}/g, "\n\n");
    const markdown = `# ${title}\n\n${body}`;

    const blob = new Blob([markdown], {
      type: "text/markdown;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-2 rounded-md cursor-pointer px-3 py-2 text-sm text-gray-500"
    >
      <Download className="h-4 w-4" />
      Download MD
    </button>
  );
}
