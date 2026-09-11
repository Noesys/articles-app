import type { Components } from "react-markdown";

/**
 * Shared ReactMarkdown element map for Contiq (admin + user).
 * Works with `prose prose-sm prose-slate` from @tailwindcss/typography;
 * table/list overrides ensure readable borders even if prose is thin.
 */
export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-slate-900 mt-5 mb-3 pb-2 border-b border-slate-200">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-slate-900 mt-5 mb-3 pb-2 border-b border-slate-200">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-slate-800 mt-4 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-slate-800 mt-3 mb-1.5">{children}</h4>
  ),
  p: ({ children }) => <p className="text-sm text-slate-700 leading-relaxed mb-3">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-1.5 text-sm text-slate-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-sm text-slate-700">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed [&>p]:mb-0 [&>p]:inline">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-slate-300 pl-4 my-3 text-slate-600 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-slate-200" />,
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return <code className={`${className ?? ""} text-[13px] leading-relaxed`}>{children}</code>;
    }
    return (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] font-mono text-slate-800">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-md border border-slate-200 bg-slate-900 p-3 text-slate-100">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 w-full overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
  tbody: ({ children }) => <tbody className="bg-white">{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-slate-200 last:border-b-0">{children}</tr>,
  th: ({ children }) => (
    <th className="border-b border-slate-200 px-3 py-2.5 align-top font-semibold text-slate-800 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-slate-100 px-3 py-2.5 align-top text-slate-700 leading-relaxed">
      {children}
    </td>
  ),
};
