import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  cleanPastedHtml,
  fileToDataUrl,
  inlineRemoteImages,
  isLikelyMarkdown,
  markdownToHtml,
} from "../lib/contentNormalize";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
import { SmartPasteOptions } from "@/utils/types";

export const SmartPaste = Extension.create<SmartPasteOptions>({
  name: "smartPaste",

  addOptions() {
    return { inlineRemoteImages: true };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;

    const insertHtml = (html: string) => {
      const pos = editor.state.selection.$anchor.pos;
      editor
        .chain()
        .focus()
        .insertContent(html, {
          parseOptions: { preserveWhitespace: false },
        })
        .run();
      // Restore selection after paste so toolbar reflects pasted content state
      if (pos !== editor.state.selection.$anchor.pos) {
        editor.commands.setTextSelection(pos);
      }
    };

    return [
      new Plugin({
        key: new PluginKey("smartPaste"),
        props: {
          handlePaste: (_view, event) => {
            const cd = (event as ClipboardEvent).clipboardData;
            if (!cd) return false;

            let html = cd.getData("text/html");
            const textEarly = cd.getData("text/plain");

            // ── FRAGMENT: line-by-line Word copy has inline-only html (no block) — wrap early so cleanPastedHtml sees a block
            if (
              html &&
              html.trim() &&
              !/<(p|h[1-6]|div|ul|ol|table|blockquote|pre)[\s>]/i.test(html) &&
              /<(span|b|strong|em|i|u)[\s>]/i.test(html)
            ) {
              html = `<p>${html}</p>`;
            }

            // ── WORD ONLINE Title / Heading via data-ccp-parastyle (Title -> h1) ──
            if (html && /data-ccp-parastyle/i.test(html)) {
              let processed = html;
              let ccpCount = 0;
              processed = processed.replace(
                /<(p|div|span)\s+([^>]*?)data-ccp-parastyle="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi,
                (
                  _m: string,
                  _tag: string,
                  _a1: string,
                  pv: string,
                  _a2: string,
                  content: string,
                ) => {
                  const t = pv.trim().toLowerCase();
                  let lvl = "h1";
                  if (t === "title") lvl = "h1";
                  else {
                    const mm = t.match(/heading\s*(\d)/i);
                    if (mm) lvl = `h${mm[1]}`;
                    else return `<p>${content}</p>`;
                  }
                  ccpCount++;
                  // Title fragmented across line breaks (EV Customer\n:\n Automating → single heading) — collapse whitespace, keep inline formatting
                  const normalized = content.replace(/\s+/g, " ").trim();
                  return `<${lvl}>${normalized}</${lvl}>`;
                },
              );
              if (ccpCount > 0) {
                event.preventDefault();
                const cleaned = cleanPastedHtml(processed);
                insertHtml(cleaned || `<p>${escapeHtml(textEarly)}</p>` || "<p></p>");
                return true;
              }
            }

            // ── INTERCEPT WORD ONLINE HEADINGS (aria-level) ──────────────
            if (html && html.includes("aria-level")) {
              let processedHtml = html;
              let conversionCount = 0;
              for (let level = 1; level <= 6; level++) {
                const pattern = new RegExp(
                  `<(p|span|div)\\s+([^>]*?)aria-level="?${level}"?([^>]*)>([\\s\\S]*?)<\\/\\1>`,
                  "gi",
                );
                processedHtml = processedHtml.replace(
                  pattern,
                  (_match: string, _tag: string, _a1: string, _a2: string, content: string) => {
                    conversionCount++;
                    return `<h${level}>${content}</h${level}>`;
                  },
                );
              }
              if (conversionCount > 0) {
                event.preventDefault();
                const cleaned = cleanPastedHtml(processedHtml);
                insertHtml(cleaned || "<p></p>");
                return true;
              }
            }

            // Manual copy from raw .md (heading selected with mouse = plain "# Heading" text) must not show raw markdown.
            // If clipboard text is markdown heading, convert via marked even when an HTML fragment exists — copy-button HTML is richer and longer, manual copy is plain text.
            const earlyIsMd = isLikelyMarkdown(textEarly);
            if (earlyIsMd) {
              const htmlLen = (html || "").length;
              // Manual mouse copy: html is tiny/same as text or missing block tags; copy-button: html is full rendered H1 (longer)
              const looksLikeManualMdCopy =
                !html ||
                !html.trim() ||
                htmlLen < textEarly.length * 2 ||
                !/<h[1-6]|<(p|div)[^>]*>/i.test(html);
              if (looksLikeManualMdCopy) {
                event.preventDefault();
                insertHtml(markdownToHtml(textEarly));
                return true;
              }
            }

            const text = cd.getData("text/plain");
            const imageFiles = Array.from(cd.files || []).filter((f) =>
              f.type.startsWith("image/"),
            );

            /* ---- 1. rich HTML document ---- */
            if (html && html.trim()) {
              event.preventDefault();
              const cleaned = cleanPastedHtml(html);
              // Fragment may clean to empty; fallback to plain text as <p> instead of showing raw tags
              insertHtml(
                cleaned && cleaned.trim()
                  ? cleaned
                  : textEarly
                    ? `<p>${escapeHtml(textEarly)}</p>`
                    : "<p></p>",
              );

              // Word dropped its images as file:/// links -> re-attach the
              // real bitmaps that came along in clipboardData.files.
              if (imageFiles.length && !/<img/i.test(cleaned)) {
                void (async () => {
                  for (const file of imageFiles) {
                    try {
                      const src = await fileToDataUrl(file);
                      editor.chain().focus().setImage({ src }).run();
                    } catch {
                      /* ignore unreadable clipboard image */
                    }
                  }
                })();
              } else if (options.inlineRemoteImages && /<img/i.test(cleaned)) {
                // Replace remote srcs with base64 so the article survives the
                // source page going away. Best effort; CORS failures are kept
                // as plain remote URLs.
                void (async () => {
                  const withData = await inlineRemoteImages(cleaned);
                  if (withData !== cleaned) {
                    // Re-render just the pasted fragment would need position
                    // bookkeeping; swapping srcs in the whole doc is safe and
                    // idempotent because data: urls are skipped.
                    const full = await inlineRemoteImages(editor.getHTML());
                    if (full !== editor.getHTML())
                      editor.commands.setContent(full, { emitUpdate: true });
                  }
                })();
              }
              return true;
            }

            /* ---- 2. bare image (screenshot / copied image) ---- */
            if (imageFiles.length && (!text || !text.trim())) {
              event.preventDefault();
              void (async () => {
                for (const file of imageFiles) {
                  try {
                    const src = await fileToDataUrl(file);
                    editor.chain().focus().setImage({ src }).run();
                  } catch {
                    /* ignore */
                  }
                }
              })();
              return true;
            }

            /* ---- 3. markdown text ---- */
            if (text && isLikelyMarkdown(text)) {
              event.preventDefault();
              insertHtml(markdownToHtml(text));
              return true;
            }

            return false;
          },

          handleDrop: (_view, event) => {
            const dt = (event as DragEvent).dataTransfer;
            const files = Array.from(dt?.files || []);
            const images = files.filter((f) => f.type.startsWith("image/"));
            const mdFile = files.find((f) => /\.mdx?$/i.test(f.name) || f.type === "text/markdown");

            if (mdFile) {
              event.preventDefault();
              void (async () => {
                insertHtml(markdownToHtml(await mdFile.text()));
              })();
              return true;
            }

            if (images.length) {
              event.preventDefault();
              void (async () => {
                for (const file of images) {
                  try {
                    const src = await fileToDataUrl(file);
                    editor.chain().focus().setImage({ src }).run();
                  } catch {
                    /* ignore */
                  }
                }
              })();
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

export default SmartPaste;
