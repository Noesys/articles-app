import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ResizableImageNodeView from "./ResizableImageNodeView";

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        // Prefer CSS width so percent values like "50%" are not lost to a
        // numeric width="50" attribute (which browsers treat as pixels).
        parseHTML: (el: HTMLElement) =>
          el.style.width || el.getAttribute("width") || null,
        renderHTML: (attrs: { width?: string | number | null }) =>
          attrs.width ? { width: attrs.width } : {},
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("height") || el.style.height || null,
        renderHTML: (attrs: { height?: string | number | null }) =>
          attrs.height ? { height: attrs.height } : {},
      },
      style: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("style"),
        renderHTML: (attrs: { style?: string | null }) =>
          attrs.style ? { style: attrs.style } : {},
      },
      textAlign: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const explicit =
            el.getAttribute("data-align") ||
            el.getAttribute("textalign") ||
            el.getAttribute("textAlign");
          if (explicit) return explicit.toLowerCase();
          const style = (el.getAttribute("style") || "").toLowerCase();
          if (
            style.includes("margin-left:auto") ||
            style.includes("margin-left: auto")
          ) {
            if (
              style.includes("margin-right:auto") ||
              style.includes("margin-right: auto")
            )
              return "center";
            return "right";
          }
          if (style.includes("margin:") && style.includes("auto")) {
            // margin: 0 auto or margin: auto -> center
            if (/margin\s*:[^;]*auto[^;]*auto/i.test(style)) return "center";
          }
          return null;
        },
        renderHTML: (attrs: { textAlign?: string | null }) => {
          if (!attrs.textAlign) return {};
          return { "data-align": attrs.textAlign };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    // Preserve % widths via style only — never emit a numeric width attr for
    // percent values (width="50" would be interpreted as 50px).
    let widthStyle: string | null = null;
    let widthAttr: string | null = null;
    if (HTMLAttributes.width != null) {
      const raw = String(HTMLAttributes.width).trim();
      if (raw.endsWith("%")) {
        widthStyle = raw;
      } else {
        const n = parseInt(raw, 10);
        if (!isNaN(n)) {
          widthStyle = `${n}px`;
          widthAttr = String(n);
        } else {
          widthStyle = raw.endsWith("px") ? raw : `${raw}px`;
        }
      }
    }
    // Strip stale width/display/margin from carried style to avoid dup on resave
    const rawStyle = String(HTMLAttributes.style || "");
    const cleanedStyle = rawStyle
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter(
        (p) => !/^(width|height|display|margin(-left|-right)?)\s*:/i.test(p),
      )
      .join("; ");
    const styleParts: string[] = [];
    if (widthStyle) styleParts.push(`width:${widthStyle}`);
    if (HTMLAttributes.height)
      styleParts.push(`height:${HTMLAttributes.height}`);
    if (cleanedStyle) styleParts.push(cleanedStyle);
    if (HTMLAttributes.textAlign === "center")
      styleParts.push("display:block; margin-left:auto; margin-right:auto");
    else if (HTMLAttributes.textAlign === "right")
      styleParts.push("display:block; margin-left:auto; margin-right:0");
    else if (HTMLAttributes.textAlign === "left")
      styleParts.push("display:block; margin-left:0; margin-right:auto");
    const style = styleParts.join("; ");
    const {
      textAlign: _ta,
      width: _w,
      style: _s,
      ...rest
    } = HTMLAttributes as Record<string, unknown>;
    const outAttrs: Record<string, unknown> = {
      ...rest,
      style: style || undefined,
    };
    if (widthAttr) outAttrs.width = widthAttr;
    return ["img", outAttrs];
  },
}).configure({ inline: false, allowBase64: true });
