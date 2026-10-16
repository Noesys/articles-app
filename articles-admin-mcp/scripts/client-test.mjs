// End-to-end smoke test: starts the built MCP (dist/index.js) over stdio and
// exercises every tool against the running local API (default localhost:8787).
// Run:  npm run build && npm test     (with `wrangler dev --local` in article-api)
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const mcpDir = path.resolve(here, "..");
const API = process.env.ARTICLE_API_URL ?? "http://localhost:8787";

const EXPECTED_TOOLS = [
  "find_person",
  "get_person",
  "get_latest_article",
  "get_article_details",
  "get_person_overview",
  "list_articles",
  "list_person_articles",
  "get_article_stats",
  "get_insights_summary",
  "get_employee_submissions",
  "list_article_types",
  "get_article_suggestions",
];

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: mcpDir,
  env: { ...process.env, ARTICLE_API_URL: API, MCP_AUTH_MODE: "dev" },
  stderr: "pipe",
});

const client = new Client({ name: "articles-admin-smoke", version: "0" });

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const asText = (r) => (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
const imageCount = (r) =>
  (r.content || []).filter((b) => b.type === "image" && (b.mimeType || "").startsWith("image/")).length;

try {
  await client.connect(transport);

  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  const missing = EXPECTED_TOOLS.filter((t) => !tools.includes(t));
  check(
    `lists ${EXPECTED_TOOLS.length} tools`,
    missing.length === 0 && tools.length === EXPECTED_TOOLS.length,
    missing.length ? `missing: ${missing.join(", ")}` : tools.join(", "),
  );

  // Ambiguity: "Priya" matches both Priya Shah and Priyanka Rao.
  const amb = await client.callTool({ name: "find_person", arguments: { query: "Priya" } });
  const ambText = asText(amb);
  check("find_person 'Priya' is ambiguous", /Priya Shah/.test(ambText) && /Priyanka Rao/.test(ambText));

  // Full overview for an exact person: profile + article + scores + inline image.
  const ov = await client.callTool({ name: "get_person_overview", arguments: { query: "Priya Shah" } });
  const ovText = asText(ov);
  check("overview shows profile", ovText.includes("Priya Shah") && ovText.includes("priya.shah@"));
  check("overview shows latest article body", ovText.includes("Edge Computing"));
  check("overview shows a real submission date", ovText.includes("Submitted:") && !/Submitted:\s*—/.test(ovText));
  check("overview shows the scores table", /Grammar/.test(ovText) && /Technical Accuracy/.test(ovText));
  check("overview inlines the article image", imageCount(ov) >= 1, `${imageCount(ov)} image block(s)`);

  // Latest article picks the newer of Priya's two articles.
  const latest = await client.callTool({
    name: "get_latest_article",
    arguments: { user_id: "usr_demo_priya" },
  });
  check("get_latest_article picks the newest", asText(latest).includes("Edge Computing"));

  // Article-only view: author rebuilt from author fields, image inline.
  const det = await client.callTool({
    name: "get_article_details",
    arguments: { article_id: "art_priya_latest" },
  });
  const detText = asText(det);
  check("article details shows the author", detText.includes("Priya Shah"));
  check(
    "article details shows scores + history",
    /Grammar/.test(detText) && /Version history/i.test(detText),
  );
  check("article details inlines the image", imageCount(det) >= 1, `${imageCount(det)} image block(s)`);

  // Rewrite-required case for a low-scoring article.
  const arjun = await client.callTool({
    name: "get_latest_article",
    arguments: { user_id: "usr_demo_arjun" },
  });
  check("low-score article shows rewrite_required", asText(arjun).includes("rewrite_required"));

  // Person with no articles.
  const meera = await client.callTool({
    name: "get_person_overview",
    arguments: { query: "Meera Iyer" },
  });
  check("person with no articles handled", /no articles yet/i.test(asText(meera)));

  // New list / stats tools
  const listed = await client.callTool({
    name: "list_articles",
    arguments: { month: "2026-09", limit: 20 },
  });
  const listedText = asText(listed);
  check(
    "list_articles for 2026-09 finds demo articles",
    /art_priya_latest/.test(listedText) || /Edge Computing/.test(listedText),
  );

  const personList = await client.callTool({
    name: "list_person_articles",
    arguments: { user_id: "usr_demo_priya", limit: 10 },
  });
  check(
    "list_person_articles returns both Priya articles",
    /art_priya_latest/.test(asText(personList)) && /art_priya_older/.test(asText(personList)),
  );

  const stats = await client.callTool({
    name: "get_article_stats",
    arguments: { month: "2026-09" },
  });
  check("get_article_stats returns totals", /Total:/i.test(asText(stats)));

  const types = await client.callTool({ name: "list_article_types", arguments: {} });
  check("list_article_types returns rubrics", /Article types/i.test(asText(types)));

  const insights = await client.callTool({
    name: "get_insights_summary",
    arguments: { start: "2026-08", end: "2026-09" },
  });
  const insightsText = asText(insights);
  check(
    "get_insights_summary shows real scores or option counts",
    !insights.isError &&
      (/avg \d/.test(insightsText) || /:\s*\d/.test(insightsText) || /no scores in range/i.test(insightsText)),
    insightsText.slice(0, 160),
  );

  const submissions = await client.callTool({
    name: "get_employee_submissions",
    arguments: { start: "2026-08", end: "2026-09" },
  });
  check(
    "get_employee_submissions runs",
    !submissions.isError && /Employee submissions/i.test(asText(submissions)),
  );

  const suggestions = await client.callTool({
    name: "get_article_suggestions",
    arguments: { article_id: "art_priya_latest" },
  });
  check(
    "get_article_suggestions is readable",
    !suggestions.isError && /suggestion/i.test(asText(suggestions)),
  );

  console.log("\n----- sample overview (truncated) -----");
  console.log(ovText.split("\n").slice(0, 18).join("\n"));
  console.log("...");
} finally {
  await client.close().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
