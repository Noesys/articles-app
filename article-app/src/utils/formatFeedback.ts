function stripOverallScore(feedback: string): string {
  return feedback
    .split("\n")
    .filter((l) => !/^\s*Overall\s*Score\s*:/i.test(l.trim()))
    .join("\n");
}
export function formatFeedbackAsMarkdown(feedback: string): string {
  if (!feedback) return "";
  feedback = stripOverallScore(feedback);

  // Already markdown-formatted? leave as-is.
  if (/^#{2,3}\s/m.test(feedback) || /^\s*-\s/m.test(feedback)) {
    return feedback;
  }

  const isHeaderLine = (line: string) =>
    /^[A-Za-z][A-Za-z\s/&-]{0,50}:$/.test(line.trim());

  const isListItemLine = (line: string) => /^\d+\.\s+/.test(line.trim());

  const lines = feedback.split("\n").map((line) => line.trim());
  const formattedLines: string[] = [];

  lines.forEach((line) => {
    if (line.length === 0) return; // drop existing blank lines, we reinsert our own

    if (isHeaderLine(line)) {
      if (formattedLines.length > 0) formattedLines.push("");
      formattedLines.push(`## ${line.replace(/:\s*$/, "")}`);
      formattedLines.push("");
      return;
    }

    if (isListItemLine(line)) {
      formattedLines.push(line.replace(/^\d+\.\s*/, "- "));
      return;
    }

    // plain paragraph line
    formattedLines.push(line);
  });

  return formattedLines.join("\n");
}
