# 1. USE CASE BLOG — ARTICLE EVALUATION PROMPT

Evaluate the provided article as an Infoveave Use Case Blog. Do not rewrite the article. Your task is to critically score the article and produce a detailed Markdown evaluation.

A strong Use Case Blog must clearly explain a real business problem, the people or teams affected by it, how the problem occurs in practice, the workflow or lifecycle involved, and how Infoveave addresses that specific problem. The article must demonstrate practical relevance rather than becoming a generic product description. The problem must be established before the Infoveave solution is introduced.
## Evidence, Scoring, and Verification Policy

Score only what is actually supported by the provided article. Do not infer missing facts, capabilities, outcomes, statistics, benchmarks, customer information, technical behavior, or industry claims from general knowledge.

Classify important claims as:
- **Supported** — directly supported by the article.
- **Partially supported** — present but insufficiently substantiated.
- **Unsupported** — asserted without adequate support.
- **Missing** — required information is absent.

Unsupported claims must not receive the same credit as supported claims. Never fill gaps with assumptions.

### Score calibration
Use these anchors when assigning points:
- **0** — Completely absent, irrelevant, or unusable.
- **1–3** — Very weak; generic, unclear, unsupported, or minimally developed.
- **4–6** — Present but underdeveloped, incomplete, or inconsistently supported.
- **7–9** — Good; specific, relevant, and reasonably well developed.
- **10–11** — Very strong; specific, comprehensive, and well supported.
- **12** — Exceptional; comprehensive, highly specific, evidence-backed, and publication-ready.

For criteria with fewer than 12 available points, scale these anchors proportionally. Do not award full marks unless the article substantially satisfies all material aspects of the criterion.

Presence alone does not constitute quality. A capability, statistic, CTA, FAQ, or other required element mentioned once should receive limited credit unless it is relevant, specific, developed, and appropriately supported.

Do not double-count the same strength across criteria. Score each criterion only for the dimension it explicitly measures.

Every criterion scoring above 50% of its available points must include a specific reason or example from the article.

### Quantitative evidence
A quantitative evidence hard gate requires at least one **meaningful** number that materially supports the article's argument, such as a verified statistic, benchmark, measured outcome, percentage, time, cost, volume, formula, or other relevant measurement.

Incidental numbers such as dates, section counts, word counts, years in a title, or arbitrary quantities do not satisfy the gate.

If a statistic, benchmark, result, customer outcome, or other factual quantitative claim is presented without adequate support where support would reasonably be expected, classify it as Unsupported and do not treat it as strong evidence.

### Substantive word count
Count substantive article content only. Do not count duplicated text, boilerplate, navigation text, metadata, captions, or template leftovers toward the 1,000-word minimum.

### Content-type fit
First determine whether the article actually fits the assigned content type. Do not reinterpret an article to make it fit. If it fundamentally functions as another content type, identify this as a critical problem and reduce the Audience & Content-Type Fit score accordingly.

### Hard-gate decision
If any hard gate fails, the final Publish Decision must be **Automatic Fail**, regardless of the numerical score. State the exact failed gate(s) and evidence.


Use these mandatory scoring rules:

* Total score: 100 points.
* Relevance: 40 points.

  * Infoveave alignment: 0–12
  * Problem/opportunity clarity: 0–10
  * Audience and content-type fit: 0–8
  * Evidence/outcomes: 0–10
* Writing: 35 points.

  * Structure: 0–12
  * Content depth and citability: 0–10
  * Voice and editorial quality: 0–8
  * Publish-ready extras: 0–5
* Readability: 25 points.

  * Length and section balance: 0–6
  * Scannability: 0–8
  * Sentence and paragraph clarity: 0–6
  * Narrative flow: 0–5

Mandatory hard gates:

1. The article must have clear Infoveave relevance.
2. The article must contain quantitative evidence, such as a verified statistic, measurable result, benchmark, percentage, time, cost, volume, or other meaningful number. Never assume or invent evidence that is not present.
3. The article must contain at least 1,000 words.
4. Copy-paste errors, duplicated sections, obvious template leftovers, or serious duplication errors are an automatic failure.
5. At least one relevant image must be planned or embedded.

The article should generally contain: a title framing the need/problem, a useful statistic or data point, definition of the core topic, detailed problem explanation, lifecycle/process/framework where relevant, business impact, stakeholder needs, Infoveave's role, solution approach, benefits/future implications, and a clear conclusion. Missing sections may be justified only when genuinely inappropriate for the specific use case.

For every major H2, check whether the section provides context/definition, explanation, an example or evidence, and an outcome/implication.

Check specifically for:

* A concrete use case rather than generic claims.
* Clear target persona or business team.
* Problem-first narrative.
* Specific Infoveave capabilities or modules.
* Quantified evidence or outcomes.
* No unsupported superlatives.
* No AI-style filler or vague statements.
* No passive feature-list writing.
* At least 5 potential FAQ questions.
* A clear CTA path.
* A title and description that could support search intent.
* Descriptive H2s.
* Paragraphs generally no longer than 4 sentences.
* A conclusion that resolves the original problem.

Score the article strictly from the text provided. Do not give credit for information that is merely implied. If a statistic, result, customer outcome, product capability, or claim cannot be verified from the article, mark it as unsupported rather than assuming it is true.

Grade:

* 85–100 = A — Publish
* 70–84 = B — Publish after targeted revision
* 55–69 = C — Substantial rewrite
* Below 55 = D — Rebrief

If a hard gate fails, explicitly mark the article as FAILED regardless of its numerical score.

Return ONLY this Markdown evaluation structure:

## Article Evaluation

| Field            | Assessment                                                                   |
| ---------------- | ---------------------------------------------------------------------------- |
| Article Title    |                                                                              |
| Intended Type    | Use Case Blog                                                                |
| Word Count       |                                                                              |
| Reviewer         | AI Evaluation                                                                |
| Overall Score    | /100                                                                         |
| Grade            | A / B / C / D                                                                |
| Publish Decision | Publish / Targeted Revision / Substantial Rewrite / Rebrief / Automatic Fail |

### Relevance — /40

| Criterion               | Score | Evaluation |
| ----------------------- | ----: | ---------- |
| Infoveave Alignment     |   /12 |            |
| Problem / Opportunity   |   /10 |            |
| Audience & Use Case Fit |    /8 |            |
| Evidence & Outcomes     |   /10 |            |

### Writing — /35

| Criterion                  | Score | Evaluation |
| -------------------------- | ----: | ---------- |
| Structure                  |   /12 |            |
| Content Depth & Citability |   /10 |            |
| Voice & Editorial Quality  |    /8 |            |
| Publish-Ready Extras       |    /5 |            |

### Readability — /25

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Length & Section Balance     |    /6 |            |
| Scannability                 |    /8 |            |
| Sentence & Paragraph Clarity |    /6 |            |
| Narrative Flow               |    /5 |            |

### Hard-Gate Check

| Requirement                        | Status      | Evidence |
| ---------------------------------- | ----------- | -------- |
| Infoveave relevance                | PASS / FAIL |          |
| Quantitative evidence              | PASS / FAIL |          |
| At least 1,000 words               | PASS / FAIL |          |
| No copy-paste / duplication errors | PASS / FAIL |          |
| At least 1 relevant image          | PASS / FAIL |          |

### Use Case Blog Quality Check

| Requirement                   | Status | Observation |
| ----------------------------- | ------ | ----------- |
| Specific business use case    |        |             |
| Clear target persona          |        |             |
| Problem before solution       |        |             |
| Specific Infoveave capability |        |             |
| Practical workflow/process    |        |             |
| Quantified outcome/evidence   |        |             |
| FAQ potential of 5+ questions |        |             |
| CTA path                      |        |             |

### Strengths

*
*
*

### Critical Problems

*
*
*

### Revision Brief

Provide the exact sections, claims, or areas that must be changed before publication. Prioritize the highest-impact problems first.

### Citability Check — Separate From /100 Score

| Requirement                                                | Status |
| ---------------------------------------------------------- | ------ |
| Direct answer appears in first 2–3 sentences               |        |
| Infoveave appears in the first paragraph                   |        |
| At least one specific Infoveave module/capability is named |        |
| At least one specific number is present                    |        |
| Search-intent H2/H3 structure is present                   |        |
| At least 3 specific citable claims are present             |        |

Do not add the Citability Check points to the 100-point score.

# 2. PLATFORM HUB CONTENT — ARTICLE EVALUATION PROMPT

Evaluate the provided article as Infoveave Platform Hub Content. Do not rewrite it. Assess whether it works as authoritative platform-level content that explains Infoveave's platform, capabilities, modules, workflows, and business value.

Platform Hub Content must go beyond describing one isolated use case. It should help the reader understand the platform-level problem, the relevant capabilities within Infoveave, how those capabilities connect, and why the platform provides value to the intended audience. Avoid turning the article into a list of product features.
## Evidence, Scoring, and Verification Policy

Score only what is actually supported by the provided article. Do not infer missing facts, capabilities, outcomes, statistics, benchmarks, customer information, technical behavior, or industry claims from general knowledge.

Classify important claims as:
- **Supported** — directly supported by the article.
- **Partially supported** — present but insufficiently substantiated.
- **Unsupported** — asserted without adequate support.
- **Missing** — required information is absent.

Unsupported claims must not receive the same credit as supported claims. Never fill gaps with assumptions.

### Score calibration
Use these anchors when assigning points:
- **0** — Completely absent, irrelevant, or unusable.
- **1–3** — Very weak; generic, unclear, unsupported, or minimally developed.
- **4–6** — Present but underdeveloped, incomplete, or inconsistently supported.
- **7–9** — Good; specific, relevant, and reasonably well developed.
- **10–11** — Very strong; specific, comprehensive, and well supported.
- **12** — Exceptional; comprehensive, highly specific, evidence-backed, and publication-ready.

For criteria with fewer than 12 available points, scale these anchors proportionally. Do not award full marks unless the article substantially satisfies all material aspects of the criterion.

Presence alone does not constitute quality. A capability, statistic, CTA, FAQ, or other required element mentioned once should receive limited credit unless it is relevant, specific, developed, and appropriately supported.

Do not double-count the same strength across criteria. Score each criterion only for the dimension it explicitly measures.

Every criterion scoring above 50% of its available points must include a specific reason or example from the article.

### Quantitative evidence
A quantitative evidence hard gate requires at least one **meaningful** number that materially supports the article's argument, such as a verified statistic, benchmark, measured outcome, percentage, time, cost, volume, formula, or other relevant measurement.

Incidental numbers such as dates, section counts, word counts, years in a title, or arbitrary quantities do not satisfy the gate.

If a statistic, benchmark, result, customer outcome, or other factual quantitative claim is presented without adequate support where support would reasonably be expected, classify it as Unsupported and do not treat it as strong evidence.

### Substantive word count
Count substantive article content only. Do not count duplicated text, boilerplate, navigation text, metadata, captions, or template leftovers toward the 1,000-word minimum.

### Content-type fit
First determine whether the article actually fits the assigned content type. Do not reinterpret an article to make it fit. If it fundamentally functions as another content type, identify this as a critical problem and reduce the Audience & Content-Type Fit score accordingly.

### Hard-gate decision
If any hard gate fails, the final Publish Decision must be **Automatic Fail**, regardless of the numerical score. State the exact failed gate(s) and evidence.


Use this scoring system:

Relevance — 40:

* Infoveave platform alignment: 0–12
* Problem/opportunity clarity: 0–10
* Audience and platform-content fit: 0–8
* Evidence/outcomes: 0–10

Writing — 35:

* Structure: 0–12
* Content depth/citability: 0–10
* Voice/editorial quality: 0–8
* Publish-ready extras: 0–5

Readability — 25:

* Length/section balance: 0–6
* Scannability: 0–8
* Sentence/paragraph clarity: 0–6
* Narrative flow: 0–5

Hard gates:

* Clear Infoveave relevance.
* At least one meaningful quantitative piece of evidence.
* At least 1,000 words.
* No copy-paste errors, duplicated content, or template leftovers.
* At least one relevant image planned or embedded.

Evaluate whether the article has a logical progression from business/operational need → platform context → explanation of the relevant capabilities → how capabilities work together → practical application → measurable impact → conclusion.

Give strong credit only when the article names specific Infoveave capabilities or modules and explains their role. Do not award points for vague statements such as “Infoveave improves efficiency” without explaining how.

Check that major H2 sections contain context/definition, explanation, evidence/example, and outcome/implication.

Also evaluate:

* Platform-level positioning.
* Clear differentiation between capabilities.
* Logical relationship between modules/features.
* Practical workflow or architecture where appropriate.
* Appropriate audience such as business, operations, analytics, or decision-makers.
* No feature dumping.
* No unsupported superlatives.
* No AI filler.
* At least 5 FAQ-worthy questions.
* CTA path.
* Search-ready title/description.
* Descriptive H2s.
* Short paragraphs and clear conclusion.

Never invent missing product information, statistics, customer results, or capabilities.

Use these grades:
85–100 A — Publish
70–84 B — Publish after targeted revision
55–69 C — Substantial rewrite
Below 55 D — Rebrief

A failed hard gate is an Automatic Fail.

Return the evaluation in exactly this Markdown format:

## Article Evaluation

| Field            | Assessment           |
| ---------------- | -------------------- |
| Article Title    |                      |
| Intended Type    | Platform Hub Content |
| Word Count       |                      |
| Overall Score    | /100                 |
| Grade            |                      |
| Publish Decision |                      |

### Relevance — /40

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Infoveave Platform Alignment |   /12 |            |
| Problem / Opportunity        |   /10 |            |
| Audience & Content-Type Fit  |    /8 |            |
| Evidence & Outcomes          |   /10 |            |

### Writing — /35

| Criterion                  | Score | Evaluation |
| -------------------------- | ----: | ---------- |
| Structure                  |   /12 |            |
| Content Depth & Citability |   /10 |            |
| Voice & Editorial Quality  |    /8 |            |
| Publish-Ready Extras       |    /5 |            |

### Readability — /25

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Length & Section Balance     |    /6 |            |
| Scannability                 |    /8 |            |
| Sentence & Paragraph Clarity |    /6 |            |
| Narrative Flow               |    /5 |            |

### Hard-Gate Check

| Requirement                      | Status      | Evidence |
| -------------------------------- | ----------- | -------- |
| Infoveave relevance              | PASS / FAIL |          |
| Quantitative evidence            | PASS / FAIL |          |
| 1,000+ words                     | PASS / FAIL |          |
| No duplication/copy-paste errors | PASS / FAIL |          |
| Relevant image                   | PASS / FAIL |          |

### Platform Hub Quality Check

| Requirement                           | Status | Observation |
| ------------------------------------- | ------ | ----------- |
| Platform-level problem is clear       |        |             |
| Specific Infoveave capabilities named |        |             |
| Capability relationships explained    |        |             |
| No feature-list treatment             |        |             |
| Practical application included        |        |             |
| Quantified evidence included          |        |             |
| FAQ potential 5+                      |        |             |
| CTA path                              |        |             |

### Strengths

*
*
*

### Critical Problems

*
*
*

### Revision Brief

*
*
*

### Citability Check — Separate From /100

| Requirement                          | Status |
| ------------------------------------ | ------ |
| Direct answer in first 2–3 sentences |        |
| Infoveave in first paragraph         |        |
| Specific module/capability named     |        |
| Specific number included             |        |
| Search-intent headings               |        |
| 3+ specific citable claims           |        |

Do not add Citability Check points to the /100 score.

# 3. INDUSTRY HUB CONTENT — ARTICLE EVALUATION PROMPT

Evaluate the provided article as Infoveave Industry Hub Content. The purpose is to determine whether the article demonstrates strong understanding of a specific industry's problems, workflows, stakeholders, metrics, and operational environment while establishing a credible and specific connection to Infoveave.

Do not rewrite the article. Score only what is actually present.
## Evidence, Scoring, and Verification Policy

Score only what is actually supported by the provided article. Do not infer missing facts, capabilities, outcomes, statistics, benchmarks, customer information, technical behavior, or industry claims from general knowledge.

Classify important claims as:
- **Supported** — directly supported by the article.
- **Partially supported** — present but insufficiently substantiated.
- **Unsupported** — asserted without adequate support.
- **Missing** — required information is absent.

Unsupported claims must not receive the same credit as supported claims. Never fill gaps with assumptions.

### Score calibration
Use these anchors when assigning points:
- **0** — Completely absent, irrelevant, or unusable.
- **1–3** — Very weak; generic, unclear, unsupported, or minimally developed.
- **4–6** — Present but underdeveloped, incomplete, or inconsistently supported.
- **7–9** — Good; specific, relevant, and reasonably well developed.
- **10–11** — Very strong; specific, comprehensive, and well supported.
- **12** — Exceptional; comprehensive, highly specific, evidence-backed, and publication-ready.

For criteria with fewer than 12 available points, scale these anchors proportionally. Do not award full marks unless the article substantially satisfies all material aspects of the criterion.

Presence alone does not constitute quality. A capability, statistic, CTA, FAQ, or other required element mentioned once should receive limited credit unless it is relevant, specific, developed, and appropriately supported.

Do not double-count the same strength across criteria. Score each criterion only for the dimension it explicitly measures.

Every criterion scoring above 50% of its available points must include a specific reason or example from the article.

### Quantitative evidence
A quantitative evidence hard gate requires at least one **meaningful** number that materially supports the article's argument, such as a verified statistic, benchmark, measured outcome, percentage, time, cost, volume, formula, or other relevant measurement.

Incidental numbers such as dates, section counts, word counts, years in a title, or arbitrary quantities do not satisfy the gate.

If a statistic, benchmark, result, customer outcome, or other factual quantitative claim is presented without adequate support where support would reasonably be expected, classify it as Unsupported and do not treat it as strong evidence.

### Substantive word count
Count substantive article content only. Do not count duplicated text, boilerplate, navigation text, metadata, captions, or template leftovers toward the 1,000-word minimum.

### Content-type fit
First determine whether the article actually fits the assigned content type. Do not reinterpret an article to make it fit. If it fundamentally functions as another content type, identify this as a critical problem and reduce the Audience & Content-Type Fit score accordingly.

### Hard-gate decision
If any hard gate fails, the final Publish Decision must be **Automatic Fail**, regardless of the numerical score. State the exact failed gate(s) and evidence.


Score out of 100:

Relevance — 40:

* Infoveave alignment: 0–12
* Industry problem/opportunity: 0–10
* Industry audience/content fit: 0–8
* Evidence/outcomes: 0–10

Writing — 35:

* Structure: 0–12
* Content depth/citability: 0–10
* Voice/editorial quality: 0–8
* Publish-ready extras: 0–5

Readability — 25:

* Length/section balance: 0–6
* Scannability: 0–8
* Sentence/paragraph clarity: 0–6
* Narrative flow: 0–5

Automatic hard gates:

* Infoveave relevance must exist.
* At least one quantitative piece of evidence must exist.
* Minimum 1,000 words.
* No copy-paste/duplication/template errors.
* At least one relevant image must be planned or embedded.

A strong Industry Hub article must show genuine industry context rather than replacing the industry name inside a generic article. Evaluate whether it identifies industry-specific pressures, workflows, stakeholders, operational problems, KPIs or outcomes, and relevant business scenarios.

The article should establish the industry problem before discussing Infoveave. It should connect specific Infoveave capabilities to actual industry needs. Generic statements such as “data is important in every industry” should receive little or no credit unless followed by specific industry evidence.

Check:

* Industry-specific terminology and context.
* Relevant personas/stakeholders.
* Industry workflows or lifecycle.
* Specific operational challenges.
* Evidence or quantitative claims.
* Relevant use cases.
* Infoveave capabilities mapped to those needs.
* Business outcomes.
* At least 5 FAQ opportunities.
* CTA.
* Search-ready title/description.
* Descriptive headings.
* Paragraphs generally ≤4 sentences.
* Strong conclusion.
* No AI filler, repetition, unsupported superlatives, or feature dumping.

Do not fabricate industry statistics, regulations, benchmarks, customer results, or Infoveave capabilities. If evidence is missing, score it as missing.

Grades:
85–100 A — Publish
70–84 B — Publish after targeted revision
55–69 C — Substantial rewrite
Below 55 D — Rebrief

Any hard-gate failure overrides the grade and produces Automatic Fail.

Return:

## Article Evaluation

| Field            | Assessment           |
| ---------------- | -------------------- |
| Article Title    |                      |
| Intended Type    | Industry Hub Content |
| Industry         |                      |
| Word Count       |                      |
| Overall Score    | /100                 |
| Grade            |                      |
| Publish Decision |                      |

### Relevance — /40

| Criterion                      | Score | Evaluation |
| ------------------------------ | ----: | ---------- |
| Infoveave Alignment            |   /12 |            |
| Industry Problem / Opportunity |   /10 |            |
| Audience & Industry Fit        |    /8 |            |
| Evidence & Outcomes            |   /10 |            |

### Writing — /35

| Criterion                  | Score | Evaluation |
| -------------------------- | ----: | ---------- |
| Structure                  |   /12 |            |
| Content Depth & Citability |   /10 |            |
| Voice & Editorial Quality  |    /8 |            |
| Publish-Ready Extras       |    /5 |            |

### Readability — /25

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Length & Section Balance     |    /6 |            |
| Scannability                 |    /8 |            |
| Sentence & Paragraph Clarity |    /6 |            |
| Narrative Flow               |    /5 |            |

### Hard-Gate Check

| Requirement           | Status      | Evidence |
| --------------------- | ----------- | -------- |
| Infoveave relevance   | PASS / FAIL |          |
| Quantitative evidence | PASS / FAIL |          |
| 1,000+ words          | PASS / FAIL |          |
| No duplication errors | PASS / FAIL |          |
| Relevant image        | PASS / FAIL |          |

### Industry Hub Quality Check

| Requirement                   | Status | Observation |
| ----------------------------- | ------ | ----------- |
| Genuine industry context      |        |             |
| Industry-specific problems    |        |             |
| Stakeholders/personas         |        |             |
| Industry workflow/lifecycle   |        |             |
| Relevant KPIs/outcomes        |        |             |
| Specific Infoveave connection |        |             |
| Multiple relevant use cases   |        |             |
| FAQ potential 5+              |        |             |

### Strengths

*
*
*

### Critical Problems

*
*
*

### Revision Brief

*
*
*

### Citability Check — Separate From /100

| Requirement                          | Status |
| ------------------------------------ | ------ |
| Direct answer in first 2–3 sentences |        |
| Infoveave in first paragraph         |        |
| Specific Infoveave capability        |        |
| Specific number                      |        |
| Search-intent headings               |        |
| 3+ citable claims                    |        |

# 4. KPI / METRICS CONTENT — ARTICLE EVALUATION PROMPT

Evaluate the provided article as Infoveave KPI/Metrics Content. Do not rewrite it. Determine whether the article accurately and usefully explains the KPI or metric, why it matters, how it is calculated or measured, what influences it, how organizations should interpret it, and how Infoveave can help monitor or improve it.

Score 100 points:
## Evidence, Scoring, and Verification Policy

Score only what is actually supported by the provided article. Do not infer missing facts, capabilities, outcomes, statistics, benchmarks, customer information, technical behavior, or industry claims from general knowledge.

Classify important claims as:
- **Supported** — directly supported by the article.
- **Partially supported** — present but insufficiently substantiated.
- **Unsupported** — asserted without adequate support.
- **Missing** — required information is absent.

Unsupported claims must not receive the same credit as supported claims. Never fill gaps with assumptions.

### Score calibration
Use these anchors when assigning points:
- **0** — Completely absent, irrelevant, or unusable.
- **1–3** — Very weak; generic, unclear, unsupported, or minimally developed.
- **4–6** — Present but underdeveloped, incomplete, or inconsistently supported.
- **7–9** — Good; specific, relevant, and reasonably well developed.
- **10–11** — Very strong; specific, comprehensive, and well supported.
- **12** — Exceptional; comprehensive, highly specific, evidence-backed, and publication-ready.

For criteria with fewer than 12 available points, scale these anchors proportionally. Do not award full marks unless the article substantially satisfies all material aspects of the criterion.

Presence alone does not constitute quality. A capability, statistic, CTA, FAQ, or other required element mentioned once should receive limited credit unless it is relevant, specific, developed, and appropriately supported.

Do not double-count the same strength across criteria. Score each criterion only for the dimension it explicitly measures.

Every criterion scoring above 50% of its available points must include a specific reason or example from the article.

### Quantitative evidence
A quantitative evidence hard gate requires at least one **meaningful** number that materially supports the article's argument, such as a verified statistic, benchmark, measured outcome, percentage, time, cost, volume, formula, or other relevant measurement.

Incidental numbers such as dates, section counts, word counts, years in a title, or arbitrary quantities do not satisfy the gate.

If a statistic, benchmark, result, customer outcome, or other factual quantitative claim is presented without adequate support where support would reasonably be expected, classify it as Unsupported and do not treat it as strong evidence.

### Substantive word count
Count substantive article content only. Do not count duplicated text, boilerplate, navigation text, metadata, captions, or template leftovers toward the 1,000-word minimum.

### Content-type fit
First determine whether the article actually fits the assigned content type. Do not reinterpret an article to make it fit. If it fundamentally functions as another content type, identify this as a critical problem and reduce the Audience & Content-Type Fit score accordingly.

### Hard-gate decision
If any hard gate fails, the final Publish Decision must be **Automatic Fail**, regardless of the numerical score. State the exact failed gate(s) and evidence.


Relevance — 40:

* Infoveave alignment: 0–12
* KPI/business problem clarity: 0–10
* Audience/content-type fit: 0–8
* Evidence/outcomes: 0–10

Writing — 35:

* Structure: 0–12
* Content depth/citability: 0–10
* Voice/editorial quality: 0–8
* Publish-ready extras: 0–5

Readability — 25:

* Length/section balance: 0–6
* Scannability: 0–8
* Sentence/paragraph clarity: 0–6
* Narrative flow: 0–5

Hard gates:

* Clear Infoveave relevance.
* At least one quantitative piece of evidence.
* At least 1,000 words.
* No duplication/copy-paste/template errors.
* At least one relevant image planned or embedded.

The KPI article must clearly define the metric, preferably in one direct sentence. Where applicable, evaluate whether it includes formula/calculation logic, numerator/denominator, units, measurement frequency, data sources, leading/lagging classification, interpretation, limitations, relevant benchmarks, and examples.

Never reward invented statistics or benchmarks. A benchmark must be supported by the article or clearly identified as requiring verification. Do not assume a formula is correct merely because it looks plausible.

Check whether the article explains:

* What the KPI measures.
* Why the KPI matters.
* How it is calculated.
* What good/poor performance means where evidence permits.
* Factors that influence the KPI.
* Common interpretation mistakes.
* Related metrics.
* How the KPI can be monitored.
* How Infoveave can collect, model, visualize, alert on, or operationalize the metric.
* A practical business example.
* Quantified evidence.
* At least 5 FAQ opportunities.
* CTA.
* Search-ready headings and metadata potential.

Do not allow the article to become an unexplained formula followed by generic product promotion.

Grades:
85–100 A — Publish
70–84 B — Publish after targeted revision
55–69 C — Substantial rewrite
Below 55 D — Rebrief

Hard-gate failure = Automatic Fail.

Return:

## Article Evaluation

| Field            | Assessment            |
| ---------------- | --------------------- |
| Article Title    |                       |
| Intended Type    | KPI / Metrics Content |
| Primary KPI      |                       |
| Word Count       |                       |
| Overall Score    | /100                  |
| Grade            |                       |
| Publish Decision |                       |

### Relevance — /40

| Criterion                  | Score | Evaluation |
| -------------------------- | ----: | ---------- |
| Infoveave Alignment        |   /12 |            |
| KPI Problem / Opportunity  |   /10 |            |
| Audience & KPI Content Fit |    /8 |            |
| Evidence & Outcomes        |   /10 |            |

### Writing — /35

| Criterion                  | Score | Evaluation |
| -------------------------- | ----: | ---------- |
| Structure                  |   /12 |            |
| Content Depth & Citability |   /10 |            |
| Voice & Editorial Quality  |    /8 |            |
| Publish-Ready Extras       |    /5 |            |

### Readability — /25

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Length & Section Balance     |    /6 |            |
| Scannability                 |    /8 |            |
| Sentence & Paragraph Clarity |    /6 |            |
| Narrative Flow               |    /5 |            |

### Hard-Gate Check

| Requirement           | Status      | Evidence |
| --------------------- | ----------- | -------- |
| Infoveave relevance   | PASS / FAIL |          |
| Quantitative evidence | PASS / FAIL |          |
| 1,000+ words          | PASS / FAIL |          |
| No duplication errors | PASS / FAIL |          |
| Relevant image        | PASS / FAIL |          |

### KPI Quality Check

| Requirement                                    | Status | Observation |
| ---------------------------------------------- | ------ | ----------- |
| Clear KPI definition                           |        |             |
| Formula/calculation explained where applicable |        |             |
| Data sources explained                         |        |             |
| Interpretation explained                       |        |             |
| Limitations/pitfalls covered                   |        |             |
| Practical example                              |        |             |
| Specific Infoveave capability                  |        |             |
| Monitoring/actionability explained             |        |             |
| FAQ potential 5+                               |        |             |

### Strengths

*
*
*

### Critical Problems

*
*
*

### Revision Brief

*
*
*

### Citability Check — Separate From /100

| Requirement                              | Status |
| ---------------------------------------- | ------ |
| Direct KPI answer in first 2–3 sentences |        |
| Infoveave in first paragraph             |        |
| Specific Infoveave capability            |        |
| Specific number/formula                  |        |
| Search-intent headings                   |        |
| 3+ citable claims                        |        |

# 5. TECHNICAL BLOG — ARTICLE EVALUATION PROMPT

Evaluate the provided article as an Infoveave Technical Blog. Do not rewrite it. Judge whether it provides technically credible, useful, sufficiently deep content for a technically informed reader while connecting the subject to Infoveave's platform or engineering context.

Technical Blog scoring:
## Evidence, Scoring, and Verification Policy

Score only what is actually supported by the provided article. Do not infer missing facts, capabilities, outcomes, statistics, benchmarks, customer information, technical behavior, or industry claims from general knowledge.

Classify important claims as:
- **Supported** — directly supported by the article.
- **Partially supported** — present but insufficiently substantiated.
- **Unsupported** — asserted without adequate support.
- **Missing** — required information is absent.

Unsupported claims must not receive the same credit as supported claims. Never fill gaps with assumptions.

### Score calibration
Use these anchors when assigning points:
- **0** — Completely absent, irrelevant, or unusable.
- **1–3** — Very weak; generic, unclear, unsupported, or minimally developed.
- **4–6** — Present but underdeveloped, incomplete, or inconsistently supported.
- **7–9** — Good; specific, relevant, and reasonably well developed.
- **10–11** — Very strong; specific, comprehensive, and well supported.
- **12** — Exceptional; comprehensive, highly specific, evidence-backed, and publication-ready.

For criteria with fewer than 12 available points, scale these anchors proportionally. Do not award full marks unless the article substantially satisfies all material aspects of the criterion.

Presence alone does not constitute quality. A capability, statistic, CTA, FAQ, or other required element mentioned once should receive limited credit unless it is relevant, specific, developed, and appropriately supported.

Do not double-count the same strength across criteria. Score each criterion only for the dimension it explicitly measures.

Every criterion scoring above 50% of its available points must include a specific reason or example from the article.

### Quantitative evidence
A quantitative evidence hard gate requires at least one **meaningful** number that materially supports the article's argument, such as a verified statistic, benchmark, measured outcome, percentage, time, cost, volume, formula, or other relevant measurement.

Incidental numbers such as dates, section counts, word counts, years in a title, or arbitrary quantities do not satisfy the gate.

If a statistic, benchmark, result, customer outcome, or other factual quantitative claim is presented without adequate support where support would reasonably be expected, classify it as Unsupported and do not treat it as strong evidence.

### Substantive word count
Count substantive article content only. Do not count duplicated text, boilerplate, navigation text, metadata, captions, or template leftovers toward the 1,000-word minimum.

### Content-type fit
First determine whether the article actually fits the assigned content type. Do not reinterpret an article to make it fit. If it fundamentally functions as another content type, identify this as a critical problem and reduce the Audience & Content-Type Fit score accordingly.

### Hard-gate decision
If any hard gate fails, the final Publish Decision must be **Automatic Fail**, regardless of the numerical score. State the exact failed gate(s) and evidence.


Relevance — 40:

* Infoveave/platform engineering alignment: 0–12
* Technical problem/opportunity: 0–10
* Technical audience/content fit: 0–8
* Evidence/outcomes: 0–10

Writing — 35:

* Structure: 0–12
* Content depth/citability: 0–10
* Voice/editorial quality: 0–8
* Publish-ready extras: 0–5

Readability — 25:

* Length/section balance: 0–6
* Scannability: 0–8
* Sentence/paragraph clarity: 0–6
* Narrative flow: 0–5

Hard gates:

* Infoveave relevance.
* Quantitative evidence.
* At least 1,000 words.
* No copy-paste/duplication/template errors.
* At least one relevant image planned or embedded.

A Technical Blog must demonstrate genuine technical depth. Evaluate whether it explains the technical problem, architecture or mechanism where relevant, implementation approach, technical decisions, dependencies, trade-offs, limitations, and practical steps.

Where code is appropriate, assess whether code examples are relevant, understandable, and technically purposeful. Do not penalize an article simply because it has no code when code would not materially improve the topic. However, a technical article that claims to provide implementation guidance should contain concrete steps, configurations, examples, pseudocode, code, API concepts, data flows, or other technically actionable material where appropriate.

Evaluate:

* Technical accuracy based only on the provided material.
* Engineering context.
* Architecture/data flow.
* Implementation steps.
* Integration considerations.
* Trade-offs and limitations.
* Security/reliability/scalability considerations where relevant.
* Specific Infoveave technical capability.
* Quantitative evidence.
* Practical outcome.
* No feature dumping.
* No vague “AI-generated” technical filler.
* No unsupported technical superlatives.
* At least 5 FAQ opportunities.
* CTA and search intent.
* Descriptive H2/H3 headings.
* Clear conclusion.

Do not invent APIs, code behavior, benchmarks, architecture, performance numbers, or product capabilities.

Grades:
85–100 A — Publish
70–84 B — Publish after targeted revision
55–69 C — Substantial rewrite
Below 55 D — Rebrief

Hard-gate failure = Automatic Fail.

Return:

## Article Evaluation

| Field            | Assessment     |
| ---------------- | -------------- |
| Article Title    |                |
| Intended Type    | Technical Blog |
| Technical Topic  |                |
| Word Count       |                |
| Overall Score    | /100           |
| Grade            |                |
| Publish Decision |                |

### Relevance — /40

| Criterion                         | Score | Evaluation |
| --------------------------------- | ----: | ---------- |
| Infoveave / Engineering Alignment |   /12 |            |
| Technical Problem / Opportunity   |   /10 |            |
| Technical Audience Fit            |    /8 |            |
| Evidence & Outcomes               |   /10 |            |

### Writing — /35

| Criterion                  | Score | Evaluation |
| -------------------------- | ----: | ---------- |
| Structure                  |   /12 |            |
| Content Depth & Citability |   /10 |            |
| Voice & Editorial Quality  |    /8 |            |
| Publish-Ready Extras       |    /5 |            |

### Readability — /25

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Length & Section Balance     |    /6 |            |
| Scannability                 |    /8 |            |
| Sentence & Paragraph Clarity |    /6 |            |
| Narrative Flow               |    /5 |            |

### Hard-Gate Check

| Requirement           | Status      | Evidence |
| --------------------- | ----------- | -------- |
| Infoveave relevance   | PASS / FAIL |          |
| Quantitative evidence | PASS / FAIL |          |
| 1,000+ words          | PASS / FAIL |          |
| No duplication errors | PASS / FAIL |          |
| Relevant image        | PASS / FAIL |          |

### Technical Quality Check

| Requirement                              | Status | Observation |
| ---------------------------------------- | ------ | ----------- |
| Genuine technical problem                |        |             |
| Technical depth                          |        |             |
| Architecture/data flow                   |        |             |
| Implementation guidance                  |        |             |
| Code/technical example where appropriate |        |             |
| Trade-offs/limitations                   |        |             |
| Specific Infoveave capability            |        |             |
| Technical outcome/evidence               |        |             |
| FAQ potential 5+                         |        |             |

### Strengths

*
*
*

### Critical Problems

*
*
*

### Revision Brief

*
*
*

### Citability Check — Separate From /100

| Requirement                             | Status |
| --------------------------------------- | ------ |
| Direct answer in first 2–3 sentences    |        |
| Infoveave in first paragraph            |        |
| Specific technical/Infoveave capability |        |
| Specific number                         |        |
| Search-intent headings                  |        |
| 3+ citable claims                       |        |

# 6. GUIDE OR FRAMEWORK — ARTICLE EVALUATION PROMPT

Evaluate the provided article as an Infoveave Guide or Framework. Do not rewrite it. Determine whether it gives the reader a practical, structured, repeatable method for solving a problem rather than simply explaining a topic.

Score 100 points:
## Evidence, Scoring, and Verification Policy

Score only what is actually supported by the provided article. Do not infer missing facts, capabilities, outcomes, statistics, benchmarks, customer information, technical behavior, or industry claims from general knowledge.

Classify important claims as:
- **Supported** — directly supported by the article.
- **Partially supported** — present but insufficiently substantiated.
- **Unsupported** — asserted without adequate support.
- **Missing** — required information is absent.

Unsupported claims must not receive the same credit as supported claims. Never fill gaps with assumptions.

### Score calibration
Use these anchors when assigning points:
- **0** — Completely absent, irrelevant, or unusable.
- **1–3** — Very weak; generic, unclear, unsupported, or minimally developed.
- **4–6** — Present but underdeveloped, incomplete, or inconsistently supported.
- **7–9** — Good; specific, relevant, and reasonably well developed.
- **10–11** — Very strong; specific, comprehensive, and well supported.
- **12** — Exceptional; comprehensive, highly specific, evidence-backed, and publication-ready.

For criteria with fewer than 12 available points, scale these anchors proportionally. Do not award full marks unless the article substantially satisfies all material aspects of the criterion.

Presence alone does not constitute quality. A capability, statistic, CTA, FAQ, or other required element mentioned once should receive limited credit unless it is relevant, specific, developed, and appropriately supported.

Do not double-count the same strength across criteria. Score each criterion only for the dimension it explicitly measures.

Every criterion scoring above 50% of its available points must include a specific reason or example from the article.

### Quantitative evidence
A quantitative evidence hard gate requires at least one **meaningful** number that materially supports the article's argument, such as a verified statistic, benchmark, measured outcome, percentage, time, cost, volume, formula, or other relevant measurement.

Incidental numbers such as dates, section counts, word counts, years in a title, or arbitrary quantities do not satisfy the gate.

If a statistic, benchmark, result, customer outcome, or other factual quantitative claim is presented without adequate support where support would reasonably be expected, classify it as Unsupported and do not treat it as strong evidence.

### Substantive word count
Count substantive article content only. Do not count duplicated text, boilerplate, navigation text, metadata, captions, or template leftovers toward the 1,000-word minimum.

### Content-type fit
First determine whether the article actually fits the assigned content type. Do not reinterpret an article to make it fit. If it fundamentally functions as another content type, identify this as a critical problem and reduce the Audience & Content-Type Fit score accordingly.

### Hard-gate decision
If any hard gate fails, the final Publish Decision must be **Automatic Fail**, regardless of the numerical score. State the exact failed gate(s) and evidence.


Relevance — 40:

* Infoveave alignment: 0–12
* Problem/opportunity clarity: 0–10
* Audience and guide/framework fit: 0–8
* Evidence/outcomes: 0–10

Writing — 35:

* Structure: 0–12
* Content depth/citability: 0–10
* Voice/editorial quality: 0–8
* Publish-ready extras: 0–5

Readability — 25:

* Length/section balance: 0–6
* Scannability: 0–8
* Sentence/paragraph clarity: 0–6
* Narrative flow: 0–5

Hard gates:

* Infoveave relevance.
* Quantitative evidence.
* At least 1,000 words.
* No duplication/copy-paste/template errors.
* At least one relevant image planned or embedded.

Because this is a Guide/Framework, assess whether the article provides a clear framework, methodology, phases, steps, decision points, checklist, or implementation process. The framework must be usable by the intended reader.

A strong guide should include a clear “who this is for” or persona explanation, define the problem, explain the framework, walk through its stages, provide examples/evidence, explain expected outcomes, and connect relevant stages to Infoveave without making the guide a product brochure.

Check:

* Clear persona/audience.
* Actionable framework.
* Logical sequence.
* Practical steps.
* Decision criteria where relevant.
* Examples/evidence.
* Outcome/implication for each major section.
* Specific Infoveave relevance.
* Quantitative evidence.
* At least 5 FAQ questions.
* CTA.
* Search-ready title/description.
* Descriptive headings.
* Short paragraphs.
* Clear conclusion.

Do not reward a list of generic advice as a “framework.” Do not invent statistics, frameworks, customer results, product capabilities, or benchmarks.

Grades:
85–100 A — Publish
70–84 B — Publish after targeted revision
55–69 C — Substantial rewrite
Below 55 D — Rebrief

Hard-gate failure = Automatic Fail.

Return:

## Article Evaluation

| Field            | Assessment        |
| ---------------- | ----------------- |
| Article Title    |                   |
| Intended Type    | Guide / Framework |
| Framework Topic  |                   |
| Word Count       |                   |
| Overall Score    | /100              |
| Grade            |                   |
| Publish Decision |                   |

### Relevance — /40

| Criterion             | Score | Evaluation |
| --------------------- | ----: | ---------- |
| Infoveave Alignment   |   /12 |            |
| Problem / Opportunity |   /10 |            |
| Audience & Guide Fit  |    /8 |            |
| Evidence & Outcomes   |   /10 |            |

### Writing — /35

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Structure                    |   /12 |            |
| Framework Depth & Citability |   /10 |            |
| Voice & Editorial Quality    |    /8 |            |
| Publish-Ready Extras         |    /5 |            |

### Readability — /25

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Length & Section Balance     |    /6 |            |
| Scannability                 |    /8 |            |
| Sentence & Paragraph Clarity |    /6 |            |
| Narrative Flow               |    /5 |            |

### Hard-Gate Check

| Requirement           | Status      | Evidence |
| --------------------- | ----------- | -------- |
| Infoveave relevance   | PASS / FAIL |          |
| Quantitative evidence | PASS / FAIL |          |
| 1,000+ words          | PASS / FAIL |          |
| No duplication errors | PASS / FAIL |          |
| Relevant image        | PASS / FAIL |          |

### Guide / Framework Quality Check

| Requirement                               | Status | Observation |
| ----------------------------------------- | ------ | ----------- |
| Clear intended persona                    |        |             |
| Problem clearly defined                   |        |             |
| Actual framework/methodology              |        |             |
| Actionable steps/phases                   |        |             |
| Decision points/checklists where relevant |        |             |
| Examples/evidence                         |        |             |
| Specific Infoveave connection             |        |             |
| Practical outcome                         |        |             |
| FAQ potential 5+                          |        |             |

### Strengths

*
*
*

### Critical Problems

*
*
*

### Revision Brief

*
*
*

### Citability Check — Separate From /100

| Requirement                          | Status |
| ------------------------------------ | ------ |
| Direct answer in first 2–3 sentences |        |
| Infoveave in first paragraph         |        |
| Specific Infoveave capability        |        |
| Specific number                      |        |
| Search-intent headings               |        |
| 3+ citable claims                    |        |

# 7. SUCCESS STORY — ARTICLE EVALUATION PROMPT

Evaluate the provided article as an Infoveave Success Story. Do not rewrite it. Judge whether it presents a credible, specific, evidence-based customer success narrative showing the situation before Infoveave, what was implemented, how it was implemented, and what measurable difference resulted.

Success Story scoring:
## Evidence, Scoring, and Verification Policy

Score only what is actually supported by the provided article. Do not infer missing facts, capabilities, outcomes, statistics, benchmarks, customer information, technical behavior, or industry claims from general knowledge.

Classify important claims as:
- **Supported** — directly supported by the article.
- **Partially supported** — present but insufficiently substantiated.
- **Unsupported** — asserted without adequate support.
- **Missing** — required information is absent.

Unsupported claims must not receive the same credit as supported claims. Never fill gaps with assumptions.

### Score calibration
Use these anchors when assigning points:
- **0** — Completely absent, irrelevant, or unusable.
- **1–3** — Very weak; generic, unclear, unsupported, or minimally developed.
- **4–6** — Present but underdeveloped, incomplete, or inconsistently supported.
- **7–9** — Good; specific, relevant, and reasonably well developed.
- **10–11** — Very strong; specific, comprehensive, and well supported.
- **12** — Exceptional; comprehensive, highly specific, evidence-backed, and publication-ready.

For criteria with fewer than 12 available points, scale these anchors proportionally. Do not award full marks unless the article substantially satisfies all material aspects of the criterion.

Presence alone does not constitute quality. A capability, statistic, CTA, FAQ, or other required element mentioned once should receive limited credit unless it is relevant, specific, developed, and appropriately supported.

Do not double-count the same strength across criteria. Score each criterion only for the dimension it explicitly measures.

Every criterion scoring above 50% of its available points must include a specific reason or example from the article.

### Quantitative evidence
A quantitative evidence hard gate requires at least one **meaningful** number that materially supports the article's argument, such as a verified statistic, benchmark, measured outcome, percentage, time, cost, volume, formula, or other relevant measurement.

Incidental numbers such as dates, section counts, word counts, years in a title, or arbitrary quantities do not satisfy the gate.

If a statistic, benchmark, result, customer outcome, or other factual quantitative claim is presented without adequate support where support would reasonably be expected, classify it as Unsupported and do not treat it as strong evidence.

### Substantive word count
Count substantive article content only. Do not count duplicated text, boilerplate, navigation text, metadata, captions, or template leftovers toward the 1,000-word minimum.

### Content-type fit
First determine whether the article actually fits the assigned content type. Do not reinterpret an article to make it fit. If it fundamentally functions as another content type, identify this as a critical problem and reduce the Audience & Content-Type Fit score accordingly.

### Hard-gate decision
If any hard gate fails, the final Publish Decision must be **Automatic Fail**, regardless of the numerical score. State the exact failed gate(s) and evidence.


Relevance — 40:

* Infoveave alignment: 0–12
* Customer problem/opportunity: 0–10
* Audience and success-story fit: 0–8
* Evidence/outcomes: 0–10

Writing — 35:

* Structure: 0–12
* Content depth/citability: 0–10
* Voice/editorial quality: 0–8
* Publish-ready extras: 0–5

Readability — 25:

* Length/section balance: 0–6
* Scannability: 0–8
* Sentence/paragraph clarity: 0–6
* Narrative flow: 0–5

Hard gates:

* Clear Infoveave relevance.
* At least one quantitative piece of evidence.
* At least 1,000 words.
* No copy-paste/duplication/template errors.
* At least one relevant image planned or embedded.

The article should provide clear client context and an “At a glance” style summary covering information such as customer/industry, challenge, solution, and outcome where the source material supports it.

Evaluate the complete story:

1. Customer/context.
2. Initial problem.
3. Business impact.
4. Goals.
5. Infoveave solution.
6. Implementation or approach.
7. How the solution changed the workflow.
8. Quantified outcomes.
9. Broader business implications.
10. Conclusion/CTA.

Quantified outcomes are especially important. Do not accept vague statements such as “significantly improved performance” as equivalent to measurable evidence. Do not invent client names, metrics, percentages, time savings, cost reductions, ROI, or outcomes.

Check:

* Client context is specific enough.
* Problem is credible and concrete.
* Baseline/before-state is clear.
* Infoveave solution is specific.
* Implementation is explained.
* Before/after difference is measurable where evidence exists.
* Results are attributable to the solution without unsupported causal claims.
* At least 5 FAQ opportunities.
* CTA.
* Search-ready title/description.
* No fabricated testimonials.
* No unsupported superlatives.
* No AI filler.
* Short paragraphs and clear conclusion.

Grades:
85–100 A — Publish
70–84 B — Publish after targeted revision
55–69 C — Substantial rewrite
Below 55 D — Rebrief

Hard-gate failure = Automatic Fail.

Return:

## Article Evaluation

| Field               | Assessment    |
| ------------------- | ------------- |
| Article Title       |               |
| Intended Type       | Success Story |
| Customer / Industry |               |
| Word Count          |               |
| Overall Score       | /100          |
| Grade               |               |
| Publish Decision    |               |

### Relevance — /40

| Criterion                      | Score | Evaluation |
| ------------------------------ | ----: | ---------- |
| Infoveave Alignment            |   /12 |            |
| Customer Problem / Opportunity |   /10 |            |
| Audience & Success Story Fit   |    /8 |            |
| Evidence & Outcomes            |   /10 |            |

### Writing — /35

| Criterion                  | Score | Evaluation |
| -------------------------- | ----: | ---------- |
| Structure                  |   /12 |            |
| Content Depth & Citability |   /10 |            |
| Voice & Editorial Quality  |    /8 |            |
| Publish-Ready Extras       |    /5 |            |

### Readability — /25

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Length & Section Balance     |    /6 |            |
| Scannability                 |    /8 |            |
| Sentence & Paragraph Clarity |    /6 |            |
| Narrative Flow               |    /5 |            |

### Hard-Gate Check

| Requirement           | Status      | Evidence |
| --------------------- | ----------- | -------- |
| Infoveave relevance   | PASS / FAIL |          |
| Quantitative evidence | PASS / FAIL |          |
| 1,000+ words          | PASS / FAIL |          |
| No duplication errors | PASS / FAIL |          |
| Relevant image        | PASS / FAIL |          |

### Success Story Quality Check

| Requirement                     | Status | Observation |
| ------------------------------- | ------ | ----------- |
| Customer context                |        |             |
| “At a glance” information       |        |             |
| Clear before-state              |        |             |
| Specific challenge              |        |             |
| Specific Infoveave solution     |        |             |
| Implementation explained        |        |             |
| Quantified before/after outcome |        |             |
| Outcome credibility             |        |             |
| FAQ potential 5+                |        |             |

### Strengths

*
*
*

### Critical Problems

*
*
*

### Revision Brief

Identify exactly which customer facts, implementation details, baseline metrics, outcome metrics, or narrative sections need improvement. Never invent missing customer evidence.

### Citability Check — Separate From /100

| Requirement                                 | Status |
| ------------------------------------------- | ------ |
| Direct result/answer in first 2–3 sentences |        |
| Infoveave in first paragraph                |        |
| Specific Infoveave capability               |        |
| Specific quantified result                  |        |
| Search-intent headings                      |        |
| 3+ citable claims                           |        |

# 8. OFFLINE MARKETING CONTENT — ARTICLE EVALUATION PROMPT

Evaluate the provided article as Infoveave Offline Marketing Content. This category includes long-form content intended to support brochures, event collateral, print campaigns, sales handouts, physical marketing material, or other offline marketing assets.

Do not rewrite the article. Evaluate whether the content communicates the business problem, Infoveave value, evidence, differentiation, and desired action clearly enough to work as marketing collateral while still satisfying the underlying editorial quality requirements.
## Evidence, Scoring, and Verification Policy

Score only what is actually supported by the provided article. Do not infer missing facts, capabilities, outcomes, statistics, benchmarks, customer information, technical behavior, or industry claims from general knowledge.

Classify important claims as:
- **Supported** — directly supported by the article.
- **Partially supported** — present but insufficiently substantiated.
- **Unsupported** — asserted without adequate support.
- **Missing** — required information is absent.

Unsupported claims must not receive the same credit as supported claims. Never fill gaps with assumptions.

### Score calibration
Use these anchors when assigning points:
- **0** — Completely absent, irrelevant, or unusable.
- **1–3** — Very weak; generic, unclear, unsupported, or minimally developed.
- **4–6** — Present but underdeveloped, incomplete, or inconsistently supported.
- **7–9** — Good; specific, relevant, and reasonably well developed.
- **10–11** — Very strong; specific, comprehensive, and well supported.
- **12** — Exceptional; comprehensive, highly specific, evidence-backed, and publication-ready.

For criteria with fewer than 12 available points, scale these anchors proportionally. Do not award full marks unless the article substantially satisfies all material aspects of the criterion.

Presence alone does not constitute quality. A capability, statistic, CTA, FAQ, or other required element mentioned once should receive limited credit unless it is relevant, specific, developed, and appropriately supported.

Do not double-count the same strength across criteria. Score each criterion only for the dimension it explicitly measures.

Every criterion scoring above 50% of its available points must include a specific reason or example from the article.

### Quantitative evidence
A quantitative evidence hard gate requires at least one **meaningful** number that materially supports the article's argument, such as a verified statistic, benchmark, measured outcome, percentage, time, cost, volume, formula, or other relevant measurement.

Incidental numbers such as dates, section counts, word counts, years in a title, or arbitrary quantities do not satisfy the gate.

If a statistic, benchmark, result, customer outcome, or other factual quantitative claim is presented without adequate support where support would reasonably be expected, classify it as Unsupported and do not treat it as strong evidence.

### Substantive word count
Count substantive article content only. Do not count duplicated text, boilerplate, navigation text, metadata, captions, or template leftovers toward the 1,000-word minimum.

### Content-type fit
First determine whether the article actually fits the assigned content type. Do not reinterpret an article to make it fit. If it fundamentally functions as another content type, identify this as a critical problem and reduce the Audience & Content-Type Fit score accordingly.

### Hard-gate decision
If any hard gate fails, the final Publish Decision must be **Automatic Fail**, regardless of the numerical score. State the exact failed gate(s) and evidence.


Score 100 points:

Relevance — 40:

* Infoveave alignment: 0–12
* Problem/opportunity clarity: 0–10
* Audience and offline-marketing fit: 0–8
* Evidence/outcomes: 0–10

Writing — 35:

* Structure: 0–12
* Content depth/citability: 0–10
* Voice/editorial quality: 0–8
* Publish-ready extras: 0–5

Readability — 25:

* Length/section balance: 0–6
* Scannability: 0–8
* Sentence/paragraph clarity: 0–6
* Narrative flow: 0–5

Hard gates:

* Clear Infoveave relevance.
* At least one quantitative piece of evidence.
* At least 1,000 words for the master content draft.
* No copy-paste, duplicated sections, or template leftovers.
* At least one relevant image planned or embedded.

The content should be modular enough to be adapted into offline layouts. Evaluate whether it has strong section headings, concise value statements, useful statistics, clear benefits, audience relevance, evidence, and a strong CTA. However, do not reward shallow promotional copy merely because it is persuasive.

The article should establish the audience's problem before presenting Infoveave. It must contain specific Infoveave relevance rather than generic claims. Benefits should be connected to actual problems or outcomes.

Check:

* Target audience is obvious.
* Business problem is concrete.
* Value proposition is clear.
* Specific Infoveave capabilities are named.
* Evidence/numbers are present and credible.
* Benefits are specific rather than generic.
* Content can be segmented into marketing modules.
* CTA is clear.
* At least 5 FAQ-worthy questions can be derived.
* No unsupported superlatives.
* No excessive promotional language.
* No AI filler.
* No repetitive messaging.
* Clear conclusion or final action.

Do not invent statistics, customer results, product claims, awards, rankings, or superlatives.

Grades:
85–100 A — Publish
70–84 B — Publish after targeted revision
55–69 C — Substantial rewrite
Below 55 D — Rebrief

Hard-gate failure = Automatic Fail.

Return:

## Article Evaluation

| Field            | Assessment                |
| ---------------- | ------------------------- |
| Article Title    |                           |
| Intended Type    | Offline Marketing Content |
| Target Audience  |                           |
| Word Count       |                           |
| Overall Score    | /100                      |
| Grade            |                           |
| Publish Decision |                           |

### Relevance — /40

| Criterion                        | Score | Evaluation |
| -------------------------------- | ----: | ---------- |
| Infoveave Alignment              |   /12 |            |
| Problem / Opportunity            |   /10 |            |
| Audience & Offline Marketing Fit |    /8 |            |
| Evidence & Outcomes              |   /10 |            |

### Writing — /35

| Criterion                  | Score | Evaluation |
| -------------------------- | ----: | ---------- |
| Structure                  |   /12 |            |
| Content Depth & Citability |   /10 |            |
| Voice & Editorial Quality  |    /8 |            |
| Publish-Ready Extras       |    /5 |            |

### Readability — /25

| Criterion                    | Score | Evaluation |
| ---------------------------- | ----: | ---------- |
| Length & Section Balance     |    /6 |            |
| Scannability                 |    /8 |            |
| Sentence & Paragraph Clarity |    /6 |            |
| Narrative Flow               |    /5 |            |

### Hard-Gate Check

| Requirement           | Status      | Evidence |
| --------------------- | ----------- | -------- |
| Infoveave relevance   | PASS / FAIL |          |
| Quantitative evidence | PASS / FAIL |          |
| 1,000+ words          | PASS / FAIL |          |
| No duplication errors | PASS / FAIL |          |
| Relevant image        | PASS / FAIL |          |

### Offline Marketing Quality Check

| Requirement                          | Status | Observation |
| ------------------------------------ | ------ | ----------- |
| Target audience is immediately clear |        |             |
| Problem is concrete                  |        |             |
| Infoveave value proposition is clear |        |             |
| Specific capabilities are included   |        |             |
| Evidence/numbers are included        |        |             |
| Benefits are specific                |        |             |
| Content is modular/scannable         |        |             |
| CTA is clear                         |        |             |
| FAQ potential 5+                     |        |             |

### Strengths

*
*
*

### Critical Problems

*
*
*

### Revision Brief

Identify the exact claims, sections, messaging, evidence, or CTA that must be improved. Prioritize changes that would most improve the score.

### Citability Check — Separate From /100

| Requirement                                            | Status |
| ------------------------------------------------------ | ------ |
| Direct answer/value proposition in first 2–3 sentences |        |
| Infoveave in first paragraph                           |        |
| Specific Infoveave capability                          |        |
| Specific number                                        |        |
| Search-intent headings where applicable                |        |
| 3+ specific citable claims                             |        |

Do not add Citability Check points to the /100 score.
