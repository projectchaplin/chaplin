# Changelog

## 2026-07-23 · Social platform: feed, series, auth + full home/nav/watch redesign

- Codex work: auth (creator/brand/super-admin accounts), creator feed with replies/likes/reposts, series + episode schema and pages, /create paths, profile media selection, brand assets.
- Home: grid gallery with 2×2 expanding hover-video tiles, flush fill with repeated tiles + 1-cell create CTA, Poppins heading "The World of AI Actors", width-animated rotating subtext (single-line at all breakpoints).
- Bottom nav: iOS-style notch cutout (CSS mask) with floating Create button that opens a role-aware popup (creator: character/video/series · brand: ad/reel · caster: video/series).
- Watch (/series): Netflix-style browse — autoplay hero, Top Stories, hover-play Top Sparks, Ads & Reels (auto-appears), Series slate.
- Magic Writer: cast picker strip with actor thumbnails right in the writer, visual "cast, together" board in the Script step.
- Shelf: compact pill filter bar (single scroll chip row), 2-up mobile grid with clamped taglines and one-line stats.
- Feed seeded with 47 real generated media posts (scripts/seed-feed-media.mjs, idempotent).
- Fixes: blurred logo (server-side downscale + q90), image quality config, brief-required gate server-side, thinking disabled on structured-output routes.
- User-facing: everything above.

## 2026-07-22 · Diagnose "stuck" Magic Character build, add progress feedback

- Verified directly against Anthropic (bypassing the app) that a full production-bible JSON build genuinely takes 35-55s on Sonnet 5 — constrained decoding on a large nested schema, not a bug. It only looked stuck because there was zero progress feedback and the page had been reloaded mid-request.
- `write/character` and `write/magic`: explicitly set `thinking: {type: "disabled"}` — this is a structured-fill task, no reasoning benefit, and removes any latency variance from Sonnet 5's default-adaptive-thinking behavior.
- Raised `maxDuration` 60→120 on both routes — observed latency (39-54s) was uncomfortably close to the old ceiling and risked a mid-generation kill in production.
- User-facing: AI Actor Builder now shows a live elapsed-time line ("Claude is writing… 23s — a full identity build usually takes 30–55s, hang tight") during a Magic Character build so the wait no longer looks broken.

## 2026-07-22 · Archetype mix + required Magic Character brief

- AI Actor Builder: archetypes are now multi-select — first pick leads (★), the rest blend in as contradictions. Stored as `archetypeMix` (primary stays in `archetype` for filters/DB).
- Magic Character: new required brief field (min a line or two) — treated as binding canon for every generated field; build blocked with a clear message until provided.
- `/api/write/character`: accepts `archetypes[]` + `characterBrief`, passes both to Claude with blend/canon guidance; local fallback also blends secondary archetypes and folds the brief in.
- Raised Claude `max_tokens` 3000→8000 (character) and 4000→8000 (magic draft) — 3000 truncated the production-bible JSON and silently dropped to local fallback.
- User-facing: archetype chips toggle, ★ marks the lead; brief textarea inside Magic Character card.
