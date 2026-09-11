import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { markdownComponents } from "./markdownComponents";

type Props = {
  children: string;
  className?: string;
};

/** Shared markdown surface for Contiq admin + user screens. */
export default function MarkdownContent({ children, className = "" }: Props) {
  return (
    <div className={`markdown-content prose prose-sm prose-slate max-w-none ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
