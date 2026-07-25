# PLAN — AI Model Index (working title)

**Date:** 2026-07-24 · **Owner:** Harsh (github: `harsh-dev1`) · **Status:** awaiting approval
**Method:** Agent OS quickstart (loop engineering, done-bar first, receipts, adversarial review)

---

## 0. The one-sentence goal

> Build a public website that pulls live AI-model rankings from the places that
> actually measure them, and on top of that publishes **my own opinionated ranking**
> of which models are best — with the reasoning and the math shown, in charts.

Two halves, and the second is the point. Mirroring other people's leaderboards is a
commodity. The product is the **opinion**, made defensible: a transparent composite
score anyone can re-derive, plus sliders so a visitor can rebuild the ranking under
their own priorities and see how much my opinion actually holds up.

---

## 1. What I verified before planning (receipts)

Every source below was probed live today, 2026-07-24. Nothing here is assumed.

| Source | Auth | Result | What it gives us |
|---|---|---|---|
| OpenRouter `GET /api/v1/models` | none | **200**, 535 KB, **345 models** | price in/out, context length, modality, reasoning support, knowledge cutoff, moderation, per-vendor counts |
| Arena mirror `api.wulong.dev/arena-ai-leaderboards/v1/*` | none | **200** | Elo score, ±CI, votes, rank, vendor, license across **11 leaderboards** (text, code, agent, vision, search, document, image, video…) |
| Arena mirror raw GitHub snapshots | none | **200**, **124 daily snapshots** back to **2026-03-19** | four months of *history* — trend charts work on day one instead of in three months |
| Aider polyglot leaderboard YAML (GitHub raw) | none | **200**, 45 KB | independent coding pass-rates, cost per run |
| LiveBench HF datasets | none | **200** | reasoning / coding / math subscores |
| Artificial Analysis `/api/v2/…` | **key required** | **401** | Intelligence Index, coding index, tok/s, time-to-first-token |

**Local toolchain:** Node 26.0.0, pnpm 11.5.1, Python 3.13, git 2.50.1.
**GitHub:** authenticated as `harsh-dev1`; token scopes include `repo` + `workflow`
(so scheduled Actions can be pushed). Orgs on the account — `Tatch-AI`, `harper-kb` —
will **not** be touched; the repo is created explicitly under the personal account.

### The one legal catch, flagged early

Artificial Analysis has the single best "intelligence index" data, but their **free
tier is licensed "internal use only with attribution — no redistribution."** Putting
it on a public website is redistribution. So: **v1 ships without Artificial Analysis.**
Every other source above is publicly redistributable with attribution. If you want AA
data later, that's a paid tier and a decision for you, not something I'll quietly do.

### CORRECTION (recorded 2026-07-24, during Wave 1 — not softened)

Two of the four sources above turned out to be **stale** once I inspected their contents
rather than just their HTTP status:

- **Aider Polyglot** — newest leaderboard entry is **2025-10-03**.
- **LiveBench** — HF datasets last modified **2025-04-07**.

Neither covers a single current frontier model. Shipping them as "live" would have been
false advertising, so both are dropped as direct sources.

**Replaced by the Epoch AI Benchmarking Hub** (`epoch.ai/data/benchmark_data.zip`),
which is strictly better: updated the same day, **CC-BY licensed (explicitly free to
redistribute with credit)**, ~70 benchmarks including GPQA Diamond, SWE-bench Verified,
FrontierMath, Terminal-Bench, ARC-AGI-2, HLE and METR time horizons — plus a *fresher*
copy of Aider Polyglot than Aider's own repository, and release dates, organisation,
country, accessibility and standard errors per model.

Final source set: **Epoch AI** (capability) · **Arena mirror** (human preference +
history) · **OpenRouter** (economics). Three independent measurement approaches —
automated benchmarks, human votes, market pricing.

---

## 2. Definition of done — the done-bar

Numbered, mechanically checkable, no optimism. A stranger with the repo URL can verify
every line. This is the contract; "done" means all of these read green.

1. A **public repo exists at `github.com/harsh-dev1/<name>`** — owner is the personal
   account, not any organization.
2. The site is **live and returns HTTP 200** at `https://harsh-dev1.github.io/<name>/`.
3. A **scheduled GitHub Action runs every 6 hours**, commits a dated data snapshot, and
   the **last 3 scheduled runs are green** (a run that produced no commit and no error is
   not green — it's a silent failure and gets treated as red).
4. **Every number on the site carries a receipt**: source name + fetch timestamp, visible
   in the UI, not just in the code.
5. **Reconciliation ≥ 95%**: at least 95% of the top-50 Arena models are matched to their
   OpenRouter pricing record. Unmatched models are **listed explicitly on the methodology
   page** — never silently dropped, because silent drops are how leaderboards lie.
6. **At least 6 distinct chart types**, all responsive down to 375 px, all driven by real
   fetched data. Zero mock data anywhere in the shipped bundle.
7. **Lighthouse ≥ 90 performance and ≥ 95 accessibility** on the home route, report
   committed to the repo.
8. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` **green in CI** on the default
   branch.
9. **The ranking is reproducible**: running `pnpm score` against the committed raw
   snapshots regenerates the published ranking **byte-identical**. A CI job asserts this.
   If my opinion can't be re-derived by a stranger, it's not an index, it's a vibe.
10. The **methodology page** states the full formula, every weight, every source, and a
    written **limitations section** (what this ranking is bad at).
11. **Graceful degradation**: if any source is down, the build still succeeds using the
    last good snapshot and the UI shows a staleness badge with the age. Verified by a
    test that simulates each source failing.
12. `plan/` governance folder committed: GOALS, DECISION-REGISTER, HANDOFF, ROAD-TO-N,
    ACTIONS-NEEDED — enough that a fresh agent could take the whole thing over cold.

---

## 3. Architecture

```
GitHub Actions (cron, every 6h)
   │
   ├─ fetch:  each source → data/raw/<source>/<ISO-date>.json   (append-only history, we own it)
   │
   ├─ normalize: raw → canonical model registry (alias resolution, dedupe)
   │
   ├─ score:  normalized → the composite index (pure function, deterministic)
   │
   └─ commit + build + deploy → GitHub Pages (static)
```

**Stack:** Vite + React + TypeScript · Tailwind CSS · Recharts for charts · Vitest for
tests · static export to GitHub Pages. No server, no database, no hosting bill. The data
*is* the git history, which means the whole thing is auditable by `git log`.

**Why snapshots get committed to our repo:** the Arena mirror is one community project
and could go stale or vanish. We backfill its 124 days once, then own every snapshot
from that day forward. The upstream becomes a bootstrap, not a dependency.

### The hard part: model identity

This is where similar sites are sloppy and where most of the engineering risk sits. The
same model appears as `claude-fable-5` on Arena, `anthropic/claude-fable-5` on OpenRouter,
and "Claude Fable 5" in Aider's YAML. Plan:

- A **canonical model registry** (`data/registry/models.yml`) — one entry per real model
  with a stable ID, vendor, release date, and an **explicit alias list** per source.
- A **deterministic matcher**: exact alias → normalized-slug → fuzzy, in that order, with
  fuzzy matches requiring a confidence threshold and getting **written into the registry
  as a proposed alias for review** rather than applied silently.
- An **unmatched report** emitted every run; CI fails if the match rate drops below the
  95% bar in done-bar #5. A new model launching should *break the build loudly*, not
  quietly disappear from the ranking.

---

## 4. The opinionated index — where "use your own brains" lives

Five pillars, each normalized to a 0–100 z-score across the eligible model set:

| Pillar | Fed by | Default weight |
|---|---|---|
| Real-world preference | Arena text + agent Elo | 30% |
| Coding ability | Arena code Elo + Aider polyglot pass-rate | 25% |
| Reasoning / knowledge | LiveBench reasoning + math subscores | 20% |
| Cost efficiency | OpenRouter blended $/M tokens (log scale) | 15% |
| Practical envelope | context length, modality breadth, reasoning-mode support | 10% |

Weights are a **starting opinion, published and argued for on the methodology page** —
not hidden constants. Three things make this more than an arbitrary weighted average:

1. **Sliders.** Visitors re-weight the pillars live and watch the ranking reorder. If my
   #1 only wins under my exact weights, the site shows that, which is the honest outcome.
2. **Named presets** encoding real use-cases, each a defensible editorial stance:
   *Best overall · Best for coding agents · Best value per dollar · Best open-weights ·
   Best for high-volume production.*
3. **Confidence bands.** Arena Elo ships a ±CI. Models whose intervals overlap are shown
   as **tied**, not ranked 3rd vs 4th. Fake precision is the most common leaderboard sin
   and refusing it is a feature.

Eligibility rules (published): model must appear in ≥2 independent sources, be generally
available (no preview-only), and have pricing. Everything excluded is listed with a reason.

### Charts

1. **Elo trend over time** — multi-line, 4 months of backfilled history, model picker.
2. **Price vs. capability scatter** — log-scale x, with the **Pareto frontier drawn**;
   the models on that curve are the actual answer to "what should I use."
3. **Vendor share of the top 10, stacked area over time** — the frontier race, visually.
4. **Radar per model** across the five pillars — the shape of a model's strengths.
5. **The Index bar ranking** with confidence bands and tie shading.
6. **Context-window vs. cost bubble chart**, bubble size = throughput.
7. *(stretch)* **Rank-change bump chart** — who overtook whom, month by month.

### Pages

`/` The Index + hero trend chart · `/model/:id` detail with receipts and history ·
`/compare` 2–4 models side by side · `/trends` the time-series deep dive ·
`/methodology` formula, weights, sources, exclusions, limitations ·
`/changelog` auto-generated ranking movements between snapshots.

---

## 5. Waves (each wave = a PR)

**Wave 0 — prove the pipe (before any features).**
Create repo, scaffold Vite app, CI, and deploy a nearly-empty page to GitHub Pages.
*Exit:* the URL returns 200. Nothing else is built until deployment is proven, because a
deploy problem discovered in week two is a week-two problem.

**Wave 1 — data layer.**
Fetchers for all four free sources · raw snapshot format · backfill 124 days of Arena
history · canonical registry + alias matcher + unmatched report · unit tests per fetcher
with recorded fixtures · the 6-hourly Action.
*Exit:* `pnpm fetch && pnpm normalize` produces a clean dataset; match rate ≥95%; the
scheduled Action has committed a snapshot on its own at least once.

**Wave 2 — scoring engine.**
Pure deterministic scoring module · presets · tie detection from CIs · the
reproducibility CI check (done-bar #9) · methodology content written.
*Exit:* `pnpm score` is byte-identical across two runs and re-derives the published table.

**Wave 3 — the site.**
All pages, all charts, weight sliders, receipts in the UI, staleness badges, dark mode,
responsive down to 375 px.
*Exit:* done-bar #6 and #11 verified.

**Wave 4 — hardening and the honest grade.**
Lighthouse, a11y pass, README, then a **fresh adversarial-review agent** that did not
build any of it tries to prove the done-bar is *not* met. Its findings become rows;
its verdict — not mine — sets the score in `ROAD-TO-N.md`.
*Exit:* every done-bar clause green under someone else's eyes.

---

## 6. Loops (the Agent OS layer)

- **Data loop** — GitHub Actions cron every 6h. Durable, survives my laptop, self-logging.
- **Verify loop** — CI on every push: typecheck, lint, test, build, reproducibility check,
  match-rate check.
- **Build loop** — during Waves 1–3 I run an iterate-until-green cycle locally against the
  done-bar rather than declaring done after one pass.
- **Grading loop** — Wave 4's fresh reviewer, re-dispatched until it stops finding P0/P1s.
- **Governance** — `plan/` folder kept current in-repo; decisions recorded as they're made.

---

## 7. Risks and how each is handled

| Risk | Handling |
|---|---|
| Arena mirror goes stale or disappears | We commit our own snapshots from day one; upstream is bootstrap only. Staleness badge surfaces it to visitors. |
| Model alias drift / new launches | Registry + loud CI failure on match-rate drop. New models break the build rather than vanishing. |
| Source rate limits or blocking | 6h cadence is gentle; caching; retry with backoff; last-good-snapshot fallback. |
| "Your ranking is arbitrary" | Published formula, sliders, confidence bands, reproducibility check, limitations section. The critique is anticipated and answered in the product. |
| Redistribution rights | AA excluded from v1; every shipped source attributed on the methodology page. |
| Scope creep | Waves are PR-sized with explicit exits; stretch items are marked stretch. |

---

## 8. What only you can decide (batched, not dripped)

1. **Repo name.** Proposals: `ai-model-index`, `frontier-index`, `which-model`, `modelboard`.
2. **Public or private?** Public is required for free GitHub Pages *and* is the point of a
   published opinion. Say the word if you'd rather it be private (then hosting changes).
3. **Artificial Analysis** — skip for v1 (my recommendation, licensing), or you obtain a
   key and we keep the site private?
4. **The weights in §4** — take my defaults as the opening editorial position, or do you
   want to set them yourself?
5. **Custom domain**, or is `harsh-dev1.github.io/<name>` fine?

---

## 9. First three commands once approved

```
gh repo create harsh-dev1/<name> --public --description "..." --clone
pnpm create vite . --template react-ts
git commit -m "chore: scaffold" && git push   # then Pages settings → Actions
```
