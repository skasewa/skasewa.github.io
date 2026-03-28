# Learning Log: Shallow Review of AI Governance for X-Risk

## Project Summary
Built a website cataloging AI governance research focused on catastrophic and existential risks from AI, modeled after [shallowreview.ai](https://shallowreview.ai) (Arb Research's Shallow Review of Technical AI Safety).

**Final stats:** 10 categories, 21 research agendas, 74 papers/reports, 17+ organizations.

---

## What I Learned: The AI Governance Landscape

### 1. There is no equivalent of the Shallow Review for AI governance
The technical AI safety community has a single, well-maintained catalog (800+ papers, 80+ agendas). The governance community does not. This is partly because:
- Governance research is published across far more venues (law reviews, policy briefs, government reports, think tanks, academic IR journals) vs. technical safety (mainly arXiv, LessWrong, Alignment Forum)
- The governance community is more fragmented — no single hub equivalent to the Alignment Forum
- The field is younger and growing fast, making catalogs hard to maintain

### 2. Key organizations and their niches
| Organization | Niche |
|---|---|
| **GovAI** (Oxford) | Broadest x-risk governance research — compute, international, corporate |
| **MIRI TGT** | Most extinction-focused; advocates for global "Off Switch" infrastructure |
| **CSET** (Georgetown) | National security + emerging tech; empirical + policy-oriented |
| **CLTR** (UK) | UK policy; risk governance at labs; loss-of-control monitoring |
| **IAPS** (DC) | Compute governance, chip controls, agent governance |
| **Convergence Analysis** | Comparative regulatory landscapes, scenario analysis |
| **Epoch AI** | Compute trends data — feeds into governance but not governance itself |
| **RAND** | Security, misuse, historical analogues (nuclear, bio) |
| **FLI** | Advocacy, AI Safety Index, autonomous weapons campaign |
| **PAI** | Multi-stakeholder; foundation model deployment guidance |

### 3. The biggest research clusters
- **Compute governance** is the most technically tractable governance lever — Lennart Heim appears on an extraordinary number of key papers
- **Responsible Scaling Policies** are the dominant corporate governance mechanism (Anthropic's RSP pioneered the model)
- **International governance** is the most ambitious and least developed area — proposals exist but implementation is far behind
- **MIRI TGT's 4-scenario framework** (Halt, US National Project, Light-Touch, Sabotage) is the most structured strategic framework

### 4. The biggest gaps (as of March 2026)
These areas are clearly important but have thin or missing research catalogs:
1. **Whistleblower protections** — despite being a live political issue post-OpenAI drama
2. **Open-source vs. closed governance** — one of the hottest debates, but few rigorous governance papers
3. **AI Safety Institutes** — UK/US AISIs exist but little analysis of their effectiveness
4. **Insurance/liability** — active in mainstream AI governance but thin in x-risk-focused work
5. **Democratic input** — citizen assemblies, public deliberation on AI risk
6. **Autonomous weapons (LAWS)** — decades of UN deliberation but thin in x-risk catalogs
7. **Compute threshold analysis** — the 10^25/10^26 FLOP numbers in the EU AI Act and Biden EO were somewhat arbitrary; limited analysis of their adequacy

### 5. The field's self-identified priorities (from Feb 2026 Summit survey)
- **Advocacy, policy, and governance** ranked as most underfunded
- **Corporate advocacy** ranked highly
- **Talent** is the binding constraint
- **Risks from aligned AI** (authoritarian lock-in, power concentration) are considered underweighted

---

## What I Learned: Building This

### Red-team findings (37 issues caught)
**Critical:**
- XSS vulnerability: `innerHTML` was used without escaping in `renderCategory()` and `renderAgenda()` — only `renderPaper()` escaped. Fixed by applying `escapeHtml()` consistently
- "et al." as standalone array entry caused double-display in rendering. Fixed by filtering it out in render + removing from data
- Duplicate paper (Dafoe 2018) appeared in two categories

**Major accessibility failures:**
- No skip-nav link
- No `<label>` on search input
- Clickable divs (agenda headers) had no `role="button"`, `tabindex`, or keyboard handlers
- Focus styles were missing across the board (search input had `outline: none` with no replacement)
- Contrast ratios failed WCAG AA — `#555570` on `#0a0a0f` was ~3.3:1 (needs 4.5:1)

**Architecture:**
- Hash routing conflicted with internal anchor links (sidebar category links would break page navigation). Fixed by only treating known page names as page routes
- Category filter buttons were commented as "populated by JS" but the JS never created them. Fixed by adding `renderCategoryFilters()`
- No null guards on paper fields in search/filter — any missing field would crash the search

### Data integrity lessons
- Papers listed with organizational authors ("CSET Georgetown", "Future of Life Institute") are inconsistent with papers listing individual researchers. Both patterns exist; the inconsistency is a stylistic choice worth documenting
- Categorization is inherently fuzzy — a compute monitoring paper is also an international governance paper. The Shallow Review approach of "pick one primary category" works but loses information
- Some papers (Epoch AI compute trends) are background data rather than governance research — need to apply the inclusion criteria strictly

---

## Architecture Decisions

### Why static HTML + vanilla JS (no framework)
- Zero build step = anyone can fork and edit
- The data file (papers.json) is the single source of truth
- Site works with any static file host (GitHub Pages, Netlify, etc.)
- Total size: ~200KB including fonts

### Data model
```
categories[] → agendas[] → papers[]
organizations[] (top-level, referenced by name in agendas)
```
Papers have: title, authors[], year, venue, url, tags[], description.
This mirrors the Shallow Review's structure.

---

## v0.3 Changes (from FEEDBACK.md)

### Fixed
1. **file:// loading** — Added `data/papers.js` (auto-generated from papers.json) loaded via `<script>` tag. Works without a server now.
2. **Search shows individual papers** — Was showing entire agendas containing any match. Now shows only matching papers in a flat list with breadcrumbs.
3. **Full-text search** — Now searches descriptions, venue, all authors, tags, agenda name/description, and organizations.
4. **Chronological sorting** — Added sort dropdown (Default / Newest first / Oldest first) in both overview and search views.
5. **Filter toggle** — Category filter buttons can now be clicked again to deselect (returns to "All").
6. **Agenda pages** — Agenda names are clickable links. Each agenda has a dedicated page at `#agenda/categoryId/agendaId`.
7. **Organizations** — Expanded About page with categorized org list (core x-risk, national security, lab safety, data/trends, multi-stakeholder).
8. **Data quality** — Removed 6 low-value entries (fellowship listings, compute trends paper, one-sentence statement, database listing). Added 4 new agendas for formerly-missing topics. See DISCARDS.md.
9. **Known gaps reduced** — Added agendas for: open-source governance, whistleblower protections, LAWS, AI Safety Institutes.

### Remaining Recommendations
1. **Validate URLs** — many are plausible but untested
2. **Cross-reference with GovAI's publication list** — they have the largest catalog
3. **Get community review** — post on EA Forum and LessWrong
4. **Consider a GitHub-based contribution workflow** — PRs to papers.json, validated by schema
5. **Add more LessWrong/EA Forum pieces** — high-quality governance posts from these venues
