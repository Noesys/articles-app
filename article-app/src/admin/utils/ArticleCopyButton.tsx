import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { buildExportMarkdown } from "./articleExport";

export default function ArticleCopyButton({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      const markdown = await buildExportMarkdown(title, text);
      const html = markdown; // same base64-inlined markdown/HTML as download
      const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (ClipboardItemCtor && navigator.clipboard.write) {
        const item = new ClipboardItemCtor({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([markdown], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(markdown);
      }
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
