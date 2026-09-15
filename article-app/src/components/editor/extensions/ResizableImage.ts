import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ResizableImageNodeView from "./ResizableImageNodeView";

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("width") || el.style.width || null,
        renderHTML: (attrs: { width?: string | number | null }) =>
          attrs.width ? { width: attrs.width } : {},
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("height") || el.style.height || null,
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
          const explicit = el.getAttribute("data-align") || el.getAttribute("textalign") || el.getAttribute("textAlign");
          if (explicit) return explicit.toLowerCase();
          const style = (el.getAttribute("style") || "").toLowerCase();
          if (style.includes("margin-left:auto") || style.includes("margin-left: auto")) {
            if (style.includes("margin-right:auto") || style.includes("margin-right: auto")) return "center";
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
    // Normalize width to ensure it survives DOMPurify + htmlparser2 (numeric width attr + px style)
    let normWidth: string | null = null;
    if (HTMLAttributes.width != null) {
      const raw = String(HTMLAttributes.width).trim();
      const num = parseInt(raw, 10);
      if (!isNaN(num)) normWidth = String(num);
    }
    const styleParts: string[] = [];
    if (normWidth) styleParts.push(`width:${normWidth}px`);
    else if (HTMLAttributes.width)
      styleParts.push(
        `width:${HTMLAttributes.width}${String(HTMLAttributes.width).endsWith("px") || String(HTMLAttributes.width).endsWith("%") ? "" : "px"}`,
      );
    if (HTMLAttributes.height) styleParts.push(`height:${HTMLAttributes.height}`);
    if (HTMLAttributes.style) styleParts.push(String(HTMLAttributes.style));
    if (HTMLAttributes.textAlign === "center")
      styleParts.push("display:block; margin-left:auto; margin-right:auto");
    else if (HTMLAttributes.textAlign === "right")
      styleParts.push("display:block; margin-left:auto; margin-right:0");
    else if (HTMLAttributes.textAlign === "left")
      styleParts.push("display:block; margin-left:0; margin-right:auto");
    const style = styleParts.join("; ");
    const { textAlign: _ta, width: _w, ...rest } = HTMLAttributes as Record<string, unknown>;
    const outAttrs: Record<string, unknown> = { ...rest, style: style || undefined };
    if (normWidth) outAttrs.width = normWidth;
    else if (HTMLAttributes.width) outAttrs.width = HTMLAttributes.width;
    return ["img", outAttrs];
  },
}).configure({ inline: false, allowBase64: true });
