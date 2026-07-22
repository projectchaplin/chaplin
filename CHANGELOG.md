# Changelog

## 2026-07-22 · Archetype mix + required Magic Character brief

- AI Actor Builder: archetypes are now multi-select — first pick leads (★), the rest blend in as contradictions. Stored as `archetypeMix` (primary stays in `archetype` for filters/DB).
- Magic Character: new required brief field (min a line or two) — treated as binding canon for every generated field; build blocked with a clear message until provided.
- `/api/write/character`: accepts `archetypes[]` + `characterBrief`, passes both to Claude with blend/canon guidance; local fallback also blends secondary archetypes and folds the brief in.
- Raised Claude `max_tokens` 3000→8000 (character) and 4000→8000 (magic draft) — 3000 truncated the production-bible JSON and silently dropped to local fallback.
- User-facing: archetype chips toggle, ★ marks the lead; brief textarea inside Magic Character card.
