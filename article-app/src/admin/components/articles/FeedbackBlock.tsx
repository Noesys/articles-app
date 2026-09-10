import { formatFeedbackAsMarkdown } from "../../../utils/formatFeedback";
import MarkdownContent from "@/components/markdown/MarkdownContent";

export default function FeedbackBlock({ feedback }: { feedback: string }) {
  const stripped = feedback
    .replace(/^###\s*Overall\s*Score:.*?\/10.*$/m, "")
    .trim();

  const fmt = formatFeedbackAsMarkdown(stripped);

  return (
    <MarkdownContent className="bg-white p-4 rounded-lg border border-slate-200">
      {fmt}
    </MarkdownContent>
  );
}
