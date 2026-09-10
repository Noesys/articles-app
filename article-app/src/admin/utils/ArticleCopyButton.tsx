import { Check, Copy } from "lucide-react";
import { useState } from "react";

function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") return html;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent ?? tmp.innerText ?? "").replace(/\u00A0/g, " ");
}

export default function ArticleCopyButton({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    const plainText = htmlToPlainText(text);
    const copyText = `# ${title}\n\n${plainText}`;

    navigator.clipboard.writeText(copyText);
    setCopied(true);

    e.stopPropagation();
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
