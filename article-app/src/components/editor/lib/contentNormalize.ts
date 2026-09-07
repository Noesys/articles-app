import { marked } from "marked";

/**
 * Shared normalisation helpers for pasted / stored article content.
 *
 * Three jobs:
 *  1. cleanPastedHtml()  -> turn Word / Google Docs clipboard HTML into clean,
 *     Tiptap-parseable HTML while KEEPING images (data: and https:).
 *  2. markdownToHtml()   -> render a pasted markdown document (incl. base64
 *     images) to HTML so Tiptap shows it formatted instead of as literal text.
 *  3. resolveContentToHtml() -> used by the editor + the preview/viewer to
 *     decide whether stored content is HTML or markdown.
 */

marked.setOptions({ gfm: true, breaks: false });

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

const MD_SIGNALS: RegExp[] = [
  /^\s{0,3}#{1,6}\s+\S/m, // # heading
  /^\s{0,3}(\*|-|\+)\s+\S/m, // - bullet
  /^\s{0,3}\d+\.\s+\S/m, // 1. ordered
  /^\s{0,3}>\s+\S/m, // > quote
  /^\s{0,3}```/m, // ``` fence
  /!\[[^\]]*\]\([^)]+\)/, // ![alt](src)  <- includes base64
  /\[[^\]]+\]\((https?:|\/|#)[^)]*\)/, // [text](url)
  /^\s{0,3}\|.+\|\s*$/m, // | table |
  /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/m, // --- rule
  /(\*\*|__)\S[\s\S]*?\1/, // **bold**
];

export function isLikelyMarkdown(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t) return false;
  // Real HTML wins; markdown files never start with a tag.
  if (/^<[a-z!][\s\S]*>/i.test(t)) return false;
  return MD_SIGNALS.some((re) => re.test(t));
}

export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return "<p></p>";
  const html = marked.parse(md, { async: false }) as string;
  return html && html.trim() ? html : "<p></p>";
}

export function isLikelyHtml(value: string): boolean {
  if (!value) return true;
  return /^\s*<[a-z!][\s\S]*>/i.test(value.trim());
}

/** Strip seeder `<!-- author_name: ... -->` prefix that breaks markdown detection */
function stripAuthorComment(s: string): string {
  return s.replace(/^\s*<!--\s*author_name:[^>]*-->\s*/i, "");
}
 /** Decide how to feed stored/incoming content into Tiptap. */
export function resolveContentToHtml(content: string): string {
  if (!content || !content.trim()) return "<p></p>";
  const stripped = stripAuthorComment(content);
  const text = stripped.trim() ? stripped : content;
  if (isLikelyMarkdown(text)) return markdownToHtml(text);
  if (isLikelyHtml(text)) return stripped.trim() ? stripped : content;
  return markdownToHtml(text);
}

/* ------------------------------------------------------------------ */
/* Word / Google Docs HTML                                             */
/* ------------------------------------------------------------------ */

/** src values Tiptap can actually render. file:// and cid: are dead links. */
export function isUsableImageSrc(src: string | null): boolean {
  if (!src) return false;
  return /^(data:image\/|https?:|blob:)/i.test(src.trim());
}

/**
 * Convert Google Docs' inline "fake bold/italic/underline" to semantic tags.
 * Google Docs represents INLINE (mid-paragraph) formatting as
 * <span style="font-weight:700">word</span> / font-style:italic /
 * text-decoration:underline — never <strong>/<em>/<u>. If we don't convert
 * these to real tags here, the later "strip presentational styles" pass in
 * cleanPastedHtml removes the style attribute, the span becomes attribute-less,
 * and the "unwrap empty spans" pass then discards the formatting entirely —
 * silently flattening every bold/italic word pasted from Docs. This only
 * covers inline spans; whole-paragraph/whole-element bold that should become
 * a HEADING is handled separately by detectAndConvertBoldHeadings below.
 */
function detectAndConvertInlineFormatting(html: string): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("span[style]").forEach((el) => {
    const style = el.getAttribute("style") || "";
    const isBold =
      /font-weight\s*:\s*(bold|7\d\d|[89]\d\d)/i.test(style);
    const isItalic = /font-style\s*:\s*italic/i.test(style);
    const isUnderline = /text-decoration\s*:\s*underline/i.test(style);
    const isStrike = /text-decoration\s*:\s*line-through/i.test(style);

    if (!isBold && !isItalic && !isUnderline && !isStrike) return;

    // Wrap innerHTML in the semantic tags that apply, innermost first so
    // e.g. bold+italic both survive (<strong><em>text</em></strong>).
    let inner = el.innerHTML;
    if (isStrike) inner = `<s>${inner}</s>`;
    if (isUnderline) inner = `<u>${inner}</u>`;
    if (isItalic) inner = `<em>${inner}</em>`;
    if (isBold) inner = `<strong>${inner}</strong>`;

    const wrapper = doc.createElement("span");
    wrapper.innerHTML = inner;
    el.replaceWith(...Array.from(wrapper.childNodes));
  });

  return doc.body.innerHTML;
}

function detectAndConvertBoldHeadings(html: string): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  let styleText = "";
  doc.querySelectorAll("style").forEach((s) => (styleText += s.textContent || ""));

  const getHeadingFromClass = (cls: string): string | null => {
    if (/MsoHeading\s*1/i.test(cls) || /MsoTitle/i.test(cls)) return "h1";
    if (/MsoHeading\s*2/i.test(cls)) return "h2";
    if (/MsoHeading\s*3/i.test(cls)) return "h3";
    return null;
  };

  // 1) Convert Word paragraphs that are actually headings (MsoHeading, outline-level, large bold)
  doc.querySelectorAll("p").forEach((p) => {
    if (p.closest("h1,h2,h3,h4,h5,h6,li,table")) return;
    const text = (p.textContent || "").trim();
    if (!text || text.length > 400) return;
    const style = p.getAttribute("style") || "";
    const cls = p.getAttribute("class") || "";

    // Check Word heading signals
    const outlineMatch = /mso-outline-level:\s*(\d)/i.exec(style);
    const styleNameMatch = /mso-style-name:\s*"?Heading\s*(\d)"?/i.exec(style);
    const classHeading = getHeadingFromClass(cls);
    // Also check styleText for this element's class defining a heading
    let level: string | null = null;
    if (outlineMatch) level = `h${outlineMatch[1]}`;
    else if (styleNameMatch) level = `h${styleNameMatch[1]}`;
    else if (classHeading) level = classHeading;
    // Fallback: large + bold heuristic for Google Docs / unstyled Word export
    if (!level) {
      const fsMatch = /font-size\s*:\s*(\d+)\s*(?:pt|px)/i.exec(style);
      const fwMatch = /font-weight\s*:\s*(bold|\d{2,3})/i.exec(style);
      let fontSize = fsMatch ? parseInt(fsMatch[1], 10) : 0;
      // pt to px approx
      if (fsMatch && /pt/i.test(fsMatch[0])) fontSize = Math.round(fontSize * 1.33);
      const isBold = fwMatch !== null || !!p.querySelector("b,strong") || /font-weight:\s*bold/i.test(style);
      const hasLarge = fontSize >= 16;
      // Only promote short paragraphs that are bold+larger than body
      if (isBold && hasLarge) {
        level = fontSize >= 22 ? "h1" : fontSize >= 18 ? "h2" : "h3";
      } else if (classHeading) {
        level = classHeading;
      }
    }
    if (level) {
      const h = doc.createElement(level);
      // Preserve inner formatting (bold/italic) but strip Word junk spans
      h.innerHTML = p.innerHTML;
      // Clean mso tab stops inside heading
      h.innerHTML = h.innerHTML.replace(/<span[^>]*mso-tab-count[^>]*>[\s\S]*?<\/span>/gi, " ").trim();
      p.replaceWith(h);
    }
  });

  // 2) Convert standalone bold spans/divs that act as headings (Google Docs)
  doc.querySelectorAll("b, strong").forEach((el) => {
    if (el.closest("h1,h2,h3,h4,h5,h6,li,p")) return;
    const text = (el.textContent || "").trim();
    if (!text || text.length > 300) return;
    const parent = el.parentElement;
    // Only if the bold element is the dominant content of its parent
    if (parent && (parent.textContent || "").trim() !== text) return;
    const style = (el.getAttribute("style") || "") + (parent?.getAttribute("style") || "");
    const fsMatch = /font-size\s*:\s*(\d+)\s*px/i.exec(style);
    const fontSize = fsMatch ? parseInt(fsMatch[1], 10) : 0;
    if (fontSize >= 18 || el.tagName === "B" || el.tagName === "STRONG") {
      // Use parent context if it looks like a heading block
      const target = parent && parent !== doc.body ? parent : el;
      if (target.closest("h1,h2,h3")) return;
      const lvl = fontSize >= 24 ? "h1" : fontSize >= 20 ? "h2" : "h3";
      const h = doc.createElement(lvl);
      h.innerHTML = target.innerHTML;
      target.replaceWith(h);
    }
  });

  return doc.body.innerHTML;
}

/**
 * Strip Office/Docs junk (conditional comments, <style>, mso-* classes,
 * <o:p>, VML shapes) but preserve structure (headings, lists, tables,
 * bold/italic) and every usable <img>.
 *
 * Runs in the browser and uses DOMParser, so it must only be called from
 * client code (paste handlers) — which is the only place we use it.
 */
export function cleanPastedHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  // Kill IE conditional comments + Word's <style> blob before parsing:
  // they can hold megabytes of mso rules and confuse the parser.
  let html = rawHtml
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<xml[\s\S]*?<\/xml>/gi, "")
    .replace(/<\/?o:[a-z]+[^>]*>/gi, "")
    .replace(/<\/?w:[a-z]+[^>]*>/gi, "");

  html = detectAndConvertBoldHeadings(html);

  html = detectAndConvertInlineFormatting(html);

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "v:imagedata" || tag === "imagedata") {
      const src = el.getAttribute("src") || el.getAttribute("o:href");
      if (isUsableImageSrc(src)) {
        const img = doc.createElement("img");
        img.setAttribute("src", src as string);
        el.replaceWith(img);
      } else {
        el.remove();
      }
    }
  });

  // Drop leftover VML / namespaced elements, keeping their text.
  doc.querySelectorAll("*").forEach((el) => {
    if (el.tagName.includes(":")) {
      el.replaceWith(...Array.from(el.childNodes));
    }
  });

  // Unusable images (file:///, cid:) are removed so we don't render broken
  // icons; the paste handler re-attaches clipboard image files instead.
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!isUsableImageSrc(src)) {
      img.remove();
      return;
    }
    img.removeAttribute("style");
    img.removeAttribute("class");
    img.removeAttribute("width");
    img.removeAttribute("height");
  });

  // Before stripping, collect Word list info (mso-list paragraphs)
  const wordListInfo = new Map<
    Element,
    { level: number; isOrdered: boolean }
  >();
  doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6").forEach((el) => {
    const style = el.getAttribute("style") || "";
    const cls = el.getAttribute("class") || "";
    if (/mso-list/i.test(style) || /MsoListParagraph/i.test(cls)) {
      const levelMatch = /level(\d+)/i.exec(style);
      const level = levelMatch ? parseInt(levelMatch[1], 10) : 1;
      // Detect bullet vs numbered: mso-list often contains lfo style but text tells us
      const raw = (el.textContent || "").trim();
      const isOrdered = /^\d+[\.\)]/.test(raw) || /^\s*\d/.test(raw);
      wordListInfo.set(el, { level, isOrdered });
    }
  });

  doc.querySelectorAll("*").forEach((el) => {
    if (el.tagName.toLowerCase() === "img") return;
    el.removeAttribute("class");
    el.removeAttribute("lang");
    el.removeAttribute("id");
    const style = el.getAttribute("style");
    if (style) {
      // Keep only text-align, which Tiptap's TextAlign extension understands.
      const align = /text-align:\s*(left|center|right|justify)/i.exec(style);
      if (align)
        el.setAttribute("style", `text-align:${align[1].toLowerCase()}`);
      else el.removeAttribute("style");
    }
    if (el.tagName.toLowerCase() === "span" && !el.attributes.length) {
      el.replaceWith(...Array.from(el.childNodes));
    }
  });

  // Convert Word "1. Heading" paragraphs (fake numbering with mso-tab-count)
  // into real <ol><li> / <ul><li> so Tiptap renders them as proper lists
  // and body text below aligns naturally instead of starting at extreme left
  // while the heading appears indented.
  // Also handles Google Docs numbering which comes as <p> with leading "1. "
  if (wordListInfo.size > 0) {
    // Process in DOM order, grouping consecutive list paragraphs into lists
    let currentList: HTMLElement | null = null;
    let currentOrdered: boolean | null = null;
    const bodyChildren = Array.from(doc.body.children) as HTMLElement[];
    for (const child of bodyChildren) {
      if (!wordListInfo.has(child)) {
        currentList = null;
        currentOrdered = null;
        continue;
      }
      const info = wordListInfo.get(child)!;
      // Use ordered/unordered based on detected text pattern
      const isOrdered = info.isOrdered;
      if (!currentList || currentOrdered !== isOrdered) {
        const list = doc.createElement(isOrdered ? "ol" : "ul");
        child.before(list);
        currentList = list;
        currentOrdered = isOrdered;
      }
      const li = doc.createElement("li");
      let text = child.innerHTML
        .replace(/^\s*(?:\d+[\.\)]|•|·)\s*(?:&nbsp;|\u00a0|\s)*/i, "")
        .replace(/<span[^>]*mso-tab-count[^>]*>[\s\S]*?<\/span>/gi, " ")
        .trim();
      // If this child is already a heading, don't wrap it in a list item
      if (/^<h[1-6]/i.test(child.outerHTML.trim())) {
        currentList = null;
        currentOrdered = null;
        continue;
      }
      li.innerHTML = text || child.textContent || "";
      currentList.appendChild(li);
      child.remove();
    }
  }

  // Fallback: even without mso-list markers, Google Docs sometimes pastes
  // numbered headings as plain "1.  Heading Title" paragraphs. Detect a run
  // of such paragraphs at the top and convert them too (heading + body pattern)
  {
    const paras = Array.from(doc.body.querySelectorAll("p")) as HTMLElement[];
    // Only convert if we see 2+ consecutive "N. text" paragraphs that look like outline
    let run: HTMLElement[] = [];
    for (const p of paras) {
      const t = (p.textContent || "").trim();
      if (
        /^\d+[\.\)]\s+\S/.test(t) &&
        t.length < 200 &&
        !p.querySelector("img,table")
      ) {
        run.push(p);
      } else if (run.length >= 2) {
        break;
      } else {
        run = [];
      }
    }
    if (run.length >= 2 && wordListInfo.size === 0) {
      let list: HTMLElement | null = null;
      for (const p of run) {
        if (!list) {
          list = doc.createElement("ol");
          p.before(list);
        }
        const li = doc.createElement("li");
        li.innerHTML =
          p.innerHTML.replace(/^\s*\d+[\.\)]\s*/, "").trim() ||
          p.textContent ||
          "";
        list.appendChild(li);
        p.remove();
      }
    }
  }

  // Word emits empty "spacer" paragraphs by the dozen.
  doc.querySelectorAll("p").forEach((p) => {
    const text = (p.textContent || "").replace(/\u00a0|\s/g, "");
    if (!text && !p.querySelector("img,table,br")) p.remove();
  });

  return doc.body.innerHTML;
}

/** True when the clipboard HTML came from Word / Outlook / Google Docs. */
export function isOfficeHtml(html: string): boolean {
  return /mso-|urn:schemas-microsoft-com|class="?Mso|docs-internal-guid/i.test(
    html || "",
  );
}

/* ------------------------------------------------------------------ */
/* Remote -> base64 (best effort)                                      */
/* ------------------------------------------------------------------ */

const MAX_INLINE_BYTES = 3 * 1024 * 1024;

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.size > MAX_INLINE_BYTES)
      return null;
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    // CORS-blocked (common for Google Docs) — leave the original URL alone.
    return null;
  }
}


export async function inlineRemoteImages(html: string): Promise<string> {
  if (!html || !/<img/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imgs = Array.from(doc.querySelectorAll("img")).filter((i) =>
    /^(https?:|blob:)/i.test(i.getAttribute("src") || ""),
  );
  if (!imgs.length) return html;
  await Promise.all(
    imgs.map(async (img) => {
      const dataUrl = await urlToDataUrl(img.getAttribute("src") as string);
      if (dataUrl) img.setAttribute("src", dataUrl);
    }),
  );
  return doc.body.innerHTML;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Could not read image file"));
    fr.readAsDataURL(file);
  });
}