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
  const handleDownload = () => {
    const markdown = `# ${title}\n\n${content}`;

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
      className="inline-flex items-center gap-2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
      title="Download MD"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
