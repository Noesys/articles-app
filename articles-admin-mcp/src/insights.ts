import type { ArticleApi } from "./api.js";
import { truncate } from "./format.js";

/** Shapes match article-api ParameterSummary / ArticleTypeSummary. */
interface ParamSummary {
  parameterId?: string;
  parameterName?: string;
  scopeType?: "numeric" | "option" | string;
  options?: Array<{ label?: string; count?: number; sortOrder?: number }>;
  numeric?: {
    avg?: number;
    min?: number;
    max?: number;
    count?: number;
  };
}

interface TypeSummary {
  articleTypeId?: string;
  articleTypeName?: string;
  totalArticles?: number;
  parameters?: ParamSummary[];
}

export async function formatInsightsSummary(
  api: ArticleApi,
  start: string,
  end: string,
): Promise<string> {
  const data = await api.getJson<TypeSummary[]>("/api/admin/insights/summary", { start, end });
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return `No insights data for ${start} → ${end}.`;
  }

  const lines = [`# Insights summary (${start} → ${end})`, ""];
  for (const t of rows) {
    lines.push(`## ${t.articleTypeName || t.articleTypeId || "Type"}`);
    lines.push(`- **Articles:** ${t.totalArticles ?? 0}`);
    for (const p of t.parameters ?? []) {
      const name = p.parameterName || p.parameterId || "Parameter";
      if (p.options?.length) {
        const bits = p.options.map((o) => `${o.label || "?"}: ${o.count ?? 0}`).join(", ");
        lines.push(`- **${name}:** ${bits}`);
      } else if (p.numeric) {
        const n = p.numeric;
        lines.push(
          `- **${name}:** avg ${n.avg ?? "—"} (min ${n.min ?? "—"}, max ${n.max ?? "—"}, n=${n.count ?? "—"})`,
        );
      } else {
        lines.push(`- **${name}:** (no scores in range)`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

interface SubmissionRow {
  userId?: string;
  name?: string;
  jobRole?: string | null;
  monthly?: Record<string, number>;
  total?: number;
}

interface SubmissionsPayload {
  months?: string[];
  rows?: SubmissionRow[];
  monthlyTotals?: Record<string, number>;
  grandTotal?: number;
}

export async function formatEmployeeSubmissions(
  api: ArticleApi,
  start: string,
  end: string,
): Promise<string> {
  const data = await api.getJson<SubmissionsPayload>("/api/admin/insights/employee-submissions", {
    start,
    end,
  });

  const months = data.months ?? [];
  const rows = data.rows ?? [];
  if (!rows.length) {
    return `No employee submissions for ${start} → ${end}.`;
  }

  const lines = [
    `# Employee submissions (${start} → ${end})`,
    "",
    `Grand total: **${data.grandTotal ?? 0}**`,
    "",
  ];

  // Cap rows so Claude's context stays usable on large teams.
  const shown = rows.slice(0, 80);
  for (const r of shown) {
    const monthBits = months
      .map((m) => `${m}:${r.monthly?.[m] ?? 0}`)
      .join(" ");
    lines.push(
      `- **${r.name || r.userId}** (${r.jobRole || "—"}) total=${r.total ?? 0} · ${monthBits}`,
    );
  }
  if (rows.length > shown.length) {
    lines.push("");
    lines.push(`_…and ${rows.length - shown.length} more people not shown._`);
  }

  if (data.monthlyTotals && months.length) {
    lines.push("");
    lines.push("### Monthly totals");
    for (const m of months) {
      lines.push(`- ${m}: ${data.monthlyTotals[m] ?? 0}`);
    }
  }

  return lines.join("\n");
}

interface ArticleTypeListItem {
  id: string;
  name: string;
  description?: string | null;
  pass_threshold?: number | null;
  score_min?: number | null;
  score_max?: number | null;
  min_words?: number | null;
  is_evaluatable?: number | boolean | null;
  score_prompt?: string | null;
  general_instructions?: string | null;
  parameter_count?: number | null;
  parameters?: Array<{
    id?: string;
    name?: string;
    prompt?: string | null;
    /** API uses camelCase (ParameterRow); accept snake_case too. */
    scopeType?: string | null;
    scope_type?: string | null;
    maxValue?: number | null;
    max_value?: number | null;
    minValue?: number | null;
    min_value?: number | null;
  }>;
}

export async function formatArticleTypes(api: ArticleApi): Promise<string> {
  const data = await api.getJson<ArticleTypeListItem[]>("/api/admin/article-types");
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return "No article types configured.";

  const lines = [`# Article types / scoring rubrics (${rows.length})`, ""];
  for (const t of rows) {
    lines.push(`## ${t.name} (\`${t.id}\`)`);
    if (t.description) lines.push(t.description);
    lines.push(
      `- **Pass threshold:** ${t.pass_threshold ?? "—"} · score range ${t.score_min ?? "—"}–${t.score_max ?? "—"} · min words ${t.min_words ?? "—"} · evaluatable: ${t.is_evaluatable ? "yes" : "no"}`,
    );
    if (t.score_prompt) {
      lines.push(`- **Score prompt:** ${truncate(t.score_prompt, 500)}`);
    }
    if (t.general_instructions) {
      lines.push(`- **General instructions:** ${truncate(t.general_instructions, 400)}`);
    }
    const params = t.parameters ?? [];
    if (params.length) {
      lines.push(`- **Parameters (${params.length}):**`);
      for (const p of params) {
        const scope = p.scopeType ?? p.scope_type ?? "?";
        const max = p.maxValue ?? p.max_value;
        lines.push(`  - ${p.name || p.id} (${scope}${max != null ? `, max ${max}` : ""})`);
      }
    } else if (t.parameter_count != null) {
      lines.push(`- **Parameters:** ${t.parameter_count}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
