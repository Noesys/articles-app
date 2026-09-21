import {
  ArticleTypeSummary,
  DateRange,
  NumericDistributionBucket,
  OptionBreakdown,
  ParameterSummary,
} from "../../types/admin-types";

/**
 * Summary is built from a fixed set of grouped queries sent as ONE db.batch
 * (one D1 round-trip) and assembled in memory. It used to run a few queries
 * per article type and per parameter, sequentially, so latency grew with
 * types x parameters — each one a separate network round-trip in production.
 */
export async function getSummary(db: D1Database, range: DateRange): Promise<ArticleTypeSummary[]> {
  const [typesRes, totalsRes, paramsRes, optionsRes, numericRes, distRes] = await db.batch([
    db.prepare(`SELECT id, name FROM article_types WHERE is_active = 1 ORDER BY name`),
    db
      .prepare(
        `
      SELECT a.article_type_id AS articleTypeId, COUNT(*) AS cnt
      FROM articles a
      WHERE a.month_year BETWEEN ? AND ?
      GROUP BY a.article_type_id
    `,
      )
      .bind(range.start, range.end),
    // min_value / max_value: numeric parameters need the full range so empty
    // buckets can be backfilled with zero counts.
    db.prepare(
      `
      SELECT p.id, p.article_type_id AS articleTypeId, p.name, p.scope_type AS scopeType,
             p.sort_order AS sortOrder, p.min_value AS minValue, p.max_value AS maxValue
      FROM parameters p
      JOIN article_types at ON at.id = p.article_type_id AND at.is_active = 1
      WHERE p.is_active = 1
      ORDER BY p.sort_order, p.name
    `,
    ),
    db
      .prepare(
        `
      SELECT po.parameter_id AS parameterId, po.label AS label, po.sort_order AS sortOrder,
             COUNT(filtered.article_id) AS cnt
      FROM parameter_options po
      JOIN parameters p ON p.id = po.parameter_id AND p.is_active = 1
      LEFT JOIN (
        SELECT apr.option_id, apr.article_id
        FROM article_parameter_results apr
        JOIN articles a ON a.id = apr.article_id AND a.version = apr.version
        WHERE a.month_year BETWEEN ? AND ?
      ) filtered ON filtered.option_id = po.id
      WHERE po.is_active = 1
      GROUP BY po.id
      ORDER BY po.parameter_id, po.sort_order
    `,
      )
      .bind(range.start, range.end),
    db
      .prepare(
        `
      SELECT apr.parameter_id AS parameterId, AVG(apr.numeric_value) AS avg,
             MIN(apr.numeric_value) AS min, MAX(apr.numeric_value) AS max, COUNT(*) AS cnt
      FROM article_parameter_results apr
      JOIN articles a ON a.id = apr.article_id AND a.version = apr.version
      WHERE a.month_year BETWEEN ? AND ?
      GROUP BY apr.parameter_id
    `,
      )
      .bind(range.start, range.end),
    db
      .prepare(
        `
      SELECT apr.parameter_id AS parameterId, apr.numeric_value AS value, COUNT(*) AS cnt
      FROM article_parameter_results apr
      JOIN articles a ON a.id = apr.article_id AND a.version = apr.version
      WHERE a.month_year BETWEEN ? AND ? AND apr.numeric_value IS NOT NULL
      GROUP BY apr.parameter_id, apr.numeric_value
    `,
      )
      .bind(range.start, range.end),
  ]);

  const articleTypes = (typesRes.results ?? []) as { id: string; name: string }[];

  const totals = new Map<string, number>();
  for (const r of (totalsRes.results ?? []) as { articleTypeId: string; cnt: number }[]) {
    totals.set(r.articleTypeId, r.cnt);
  }

  const optionsByParam = new Map<string, OptionBreakdown[]>();
  for (const r of (optionsRes.results ?? []) as {
    parameterId: string;
    label: string;
    sortOrder: number;
    cnt: number;
  }[]) {
    const list = optionsByParam.get(r.parameterId) ?? [];
    list.push({ label: r.label, count: r.cnt, sortOrder: r.sortOrder });
    optionsByParam.set(r.parameterId, list);
  }

  const numericByParam = new Map<
    string,
    { avg: number | null; min: number | null; max: number | null; cnt: number }
  >();
  for (const r of (numericRes.results ?? []) as {
    parameterId: string;
    avg: number | null;
    min: number | null;
    max: number | null;
    cnt: number;
  }[]) {
    numericByParam.set(r.parameterId, r);
  }

  const countsByParam = new Map<string, Map<number, number>>();
  for (const r of (distRes.results ?? []) as {
    parameterId: string;
    value: number;
    cnt: number;
  }[]) {
    const m = countsByParam.get(r.parameterId) ?? new Map<number, number>();
    m.set(r.value, r.cnt);
    countsByParam.set(r.parameterId, m);
  }

  const paramsByType = new Map<string, ParameterSummary[]>();
  for (const p of (paramsRes.results ?? []) as {
    id: string;
    articleTypeId: string;
    name: string;
    scopeType: string;
    sortOrder: number;
    minValue: number | null;
    maxValue: number | null;
  }[]) {
    let summary: ParameterSummary;

    if (p.scopeType === "option") {
      summary = {
        parameterId: p.id,
        parameterName: p.name,
        scopeType: "option",
        sortOrder: p.sortOrder,
        options: optionsByParam.get(p.id) ?? [],
      };
    } else {
      const row = numericByParam.get(p.id);

      // One bucket per whole number from min up to max (whole-number scores
      // only — same as the recursive CTE this replaced).
      const distribution: NumericDistributionBucket[] = [];
      if (p.minValue != null && p.maxValue != null) {
        const counts = countsByParam.get(p.id);
        let value = Math.trunc(p.minValue);
        distribution.push({ value, count: counts?.get(value) ?? 0 });
        while (value < p.maxValue) {
          value += 1;
          distribution.push({ value, count: counts?.get(value) ?? 0 });
        }
      }

      summary = {
        parameterId: p.id,
        parameterName: p.name,
        scopeType: "numeric",
        sortOrder: p.sortOrder,
        numeric: {
          avg: row?.avg ?? 0,
          min: row?.min ?? 0,
          max: row?.max ?? 0,
          count: row?.cnt ?? 0,
          distribution,
        },
      };
    }

    const list = paramsByType.get(p.articleTypeId) ?? [];
    list.push(summary);
    paramsByType.set(p.articleTypeId, list);
  }

  return articleTypes.map((at) => ({
    articleTypeId: at.id,
    articleTypeName: at.name,
    totalArticles: totals.get(at.id) ?? 0,
    parameters: paramsByType.get(at.id) ?? [],
  }));
}

interface EmployeeSubmissionRow {
  userId: string;
  name: string;
  jobRole: string;
  monthly: Record<string, number>;
  total: number;
}

interface EmployeeSubmissionsResult {
  months: string[];
  rows: EmployeeSubmissionRow[];
  monthlyTotals: Record<string, number>;
  grandTotal: number;
}

function enumerateMonths(start: string, end: string): string[] {
  const months: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

export async function getEmployeeSubmissions(
  db: D1Database,
  range: DateRange,
): Promise<EmployeeSubmissionsResult> {
  const months = enumerateMonths(range.start, range.end);

  const rowsRaw = await db
    .prepare(
      `
    SELECT
      COALESCE(u.id, ue.id, 'emp_' || a.emp_id) AS userId,
      COALESCE(u.name, ue.name, a.employee_email) AS name,
      COALESCE(u.job_role, ue.job_role) AS jobRole,
      a.month_year AS monthYear, COUNT(*) AS cnt
    FROM articles a
    LEFT JOIN users u
      ON u.id = a.user_id
    LEFT JOIN users ue
      ON a.employee_email IS NOT NULL
      AND lower(ue.email) = lower(a.employee_email)
    WHERE a.month_year BETWEEN ? AND ?
    GROUP BY COALESCE(u.id, ue.id, 'emp_' || a.emp_id), a.month_year
    ORDER BY name
  `,
    )
    .bind(range.start, range.end)
    .all();

  const byUser = new Map<string, EmployeeSubmissionRow>();
  const monthlyTotals: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  let grandTotal = 0;

  for (const r of rowsRaw.results as {
    userId: string;
    name: string;
    jobRole: string;
    monthYear: string;
    cnt: number;
  }[]) {
    if (!byUser.has(r.userId)) {
      byUser.set(r.userId, {
        userId: r.userId,
        name: r.name,
        jobRole: r.jobRole,
        monthly: Object.fromEntries(months.map((m) => [m, 0])),
        total: 0,
      });
    }
    const row = byUser.get(r.userId)!;
    row.monthly[r.monthYear] = r.cnt;
    row.total += r.cnt;
    monthlyTotals[r.monthYear] += r.cnt;
    grandTotal += r.cnt;
  }

  return {
    months,
    rows: Array.from(byUser.values()),
    monthlyTotals,
    grandTotal,
  };
}
