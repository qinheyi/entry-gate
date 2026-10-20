# Entry Gate — Friction Log (Amazon Developer Hackathon)

Optional Devpost field (up to +10%). Captured while building Entry Gate for Build, Ship, Shape: Amazon Developer Hackathon.

## Entry 1 — YouTube duration via oEmbed

- **Task:** Verify demo video is ≤180 seconds for Devpost/Alexa+ rules.
- **Steps:** Call YouTube oEmbed with the public watch URL; read `duration`.
- **Expected:** Duration in seconds (as Vimeo oEmbed provides).
- **Actual:** Title/author only; `duration` absent.
- **Severity:** Important (blocks a hard pass/fail on video length).
- **Workaround:** Mark duration as “unknown” and warn the builder to confirm manually.
- **Suggestion:** Document that YouTube oEmbed omits duration, or provide a recommended free duration API for hackathon demos.

## Entry 2 — MiniMax model env on Vercel

- **Task:** Enable spoken LLM summary on production.
- **Steps:** Set `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL` as Vercel secrets; redeploy; call `/api/audit`.
- **Expected:** Narration with model `MiniMax-M3`.
- **Actual:** HTTP 400 `unknown model 'minimax_model=minimax-m3'` when the secret value was malformed.
- **Severity:** Important (silent degrade to rules-only summary).
- **Workaround:** Sanitize env (`minimax_model=…` → `MiniMax-M3`); re-set secret; redeploy.
- **Suggestion:** Provider should reject or normalize obvious key=value mistakes in the model field with a clearer error.

Repo: https://github.com/qinheyi/entry-gate  
Demo: https://entry-gate.vercel.app
