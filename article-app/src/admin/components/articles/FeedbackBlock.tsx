import remarkGfm from "remark-gfm";
import { formatFeedbackAsMarkdown } from "../../../utils/formatFeedback";
import ReactMarkdown, { type Components } from "react-markdown";

const feedbackMarkdownComponents: Components = {
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-bold text-slate-900 mt-4 mb-3 border-b border-slate-200 pb-2">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-semibold text-slate-800 mt-3 mb-2">
      {children}
    </h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside ml-2 mb-3 space-y-1">{children}</ul>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm text-slate-700 leading-relaxed">{children}</li>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm text-slate-600 mb-2">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
};

export default function FeedbackBlock({ feedback }: { feedback: string }) {
  const stripped = feedback
    .replace(/^###\s*Overall\s*Score:.*?\/10.*$/m, "")
    .trim();

  const fmt = formatFeedbackAsMarkdown(stripped);

  return (
    <div className="prose prose-sm prose-slate max-w-none bg-white p-4 rounded-lg border border-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={feedbackMarkdownComponents}
      >
        {fmt}
      </ReactMarkdown>
    </div>
  );
}
