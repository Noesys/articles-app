import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ResizableImageNodeView from "./ResizableImageNodeView";

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("width") || el.style.width || null,
        renderHTML: (attrs: { width?: string | number | null }) => (attrs.width ? { width: attrs.width } : {}),
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
        renderHTML: (attrs: { style?: string | null }) => (attrs.style ? { style: attrs.style } : {}),
      },
      textAlign: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const explicit =
            el.getAttribute("textalign") || el.getAttribute("textAlign");
          if (explicit) return explicit;
          const style = el.getAttribute("style") || "";
          if (
            style.includes("margin-left: auto") &&
            style.includes("margin-right: auto")
          )
            return "center";
          if (
            style.includes("margin-left: auto") &&
            style.includes("margin-right: 0")
          )
            return "right";
          if (style.includes("margin-left: auto")) return "right";
          return null;
        },
        renderHTML: (attrs: { textAlign?: string | null }) => {
          if (!attrs.textAlign) return {};
          return { textAlign: attrs.textAlign };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const styleParts: string[] = [];
    if (HTMLAttributes.width)
      styleParts.push(
        `width:${HTMLAttributes.width}${String(HTMLAttributes.width).endsWith("px") || String(HTMLAttributes.width).endsWith("%") ? "" : "px"}`,
      );
    if (HTMLAttributes.height)
      styleParts.push(`height:${HTMLAttributes.height}`);
    if (HTMLAttributes.style) styleParts.push(String(HTMLAttributes.style));
    // Wrap image in aligned paragraph for preview portability
    // The actual alignment is stored as a wrapper style, but for static HTML
    // (preview/article viewer) we emit margin auto on the img itself.
    if (HTMLAttributes.textAlign === "center")
      styleParts.push("display:block; margin-left:auto; margin-right:auto");
    else if (HTMLAttributes.textAlign === "right")
      styleParts.push("display:block; margin-left:auto; margin-right:0");
    else if (HTMLAttributes.textAlign === "left")
      styleParts.push("display:block; margin-left:0; margin-right:auto");
    const style = styleParts.join("; ");
    const { textAlign: _ta, ...rest } = HTMLAttributes;
    return ["img", { ...rest, style: style || undefined }];
  },
}).configure({ inline: false, allowBase64: true });
