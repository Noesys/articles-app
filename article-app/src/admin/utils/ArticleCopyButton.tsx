import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { buildExportMarkdown } from "./articleExport";

export default function ArticleCopyButton({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      const markdown = await buildExportMarkdown(title, text);
      // Markdown syntax (headings, ![alt](src)) isn't HTML — a text/html
      // clipboard entry previously carried this same string, so paste
      // destinations that prefer text/html (Word, Gmail, Slack, ...) rendered
      // only the literal <img> tags as images and everything else as inert
      // text, including any image left in ![]() form. Plain text is the
      // correct, single representation of "copy the markdown".
      await navigator.clipboard.writeText(markdown);
    } catch {
      await navigator.clipboard.writeText(`# ${title}\n\n${text}`);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
      title="Copy"
    >
      {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
    </button>
  );
}
