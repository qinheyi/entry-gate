# Entry Gate — Devpost submission draft (English)

Prepared: 2026-10-12 Asia/Shanghai (updated from 2026-10-11 draft)  
Hackathon: [Build, Ship, Shape: Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/)  
Track: **Alexa+** (simulated Alexa+ experience; no Echo / no live MCP required)  
Account: Devpost `qinheyi267` · Email `qinheyi@agentmail.to`  
Status: **DRAFT TEXT ONLY** — registered 2026-10-11. Do **not** final-submit until a public YouTube/Vimeo demo (&lt;3 min) is ready. Target submit ~2026-10-23 AM Beijing.

---

## Form fields (copy-paste)

### Submission name
Entry Gate

### Tagline (≤140 characters)
Paste demo, repo, and video links — an Alexa+-style steward audits your hackathon entry before you hit Submit.

Character count: 118

### Built with (suggested tags)
Next.js, TypeScript, MiniMax, Vercel, GitHub API, Alexa+ (simulated), Web Speech API

### Primary track
Alexa+

### Mini challenges
None for now (optional later: Open Source is already satisfied by public MIT `qinheyi/entry-gate` if the form asks; AWS Builder skipped — no Bedrock credits).

### Demo link
https://entry-gate.vercel.app

### GitHub repo
https://github.com/qinheyi/entry-gate  
Public · MIT · README + LICENSE present

### Demo video
**TODO — user action (~2026-10-23 AM Beijing):** screen-record &lt;3 min using `DEMO_VIDEO_SCRIPT.md`, upload YouTube or Vimeo as **public**, paste URL here.

### Description (≤500 words)

Entry Gate is a simulated Alexa+ submission steward. Instead of answering trivia about contest rules, it **verifies** the artifacts you are about to submit.

You paste a live demo URL, a GitHub repo, and (optionally) a YouTube or Vimeo link, then ask whether you are ready to submit. Entry Gate runs a short tool loop:

1. **fetch_page** — GET the demo; report HTTP status, title, and soft failures (auth walls, thin pages).  
2. **check_repo** — confirm the repo is public, has a LICENSE and README (with light setup-quality hints), description, and recent push.  
3. **check_video_meta** — oEmbed title/duration when a video URL is present; flag videos over 3 minutes.  
4. **score_checklist** — deterministic rubric → **go / almost / no-go**, score, ranked fixes, plus Amazon product-feedback / friction-log reminders.  
5. Optional **MiniMax** narration for a spoken-style summary (falls back to rules if the key is unavailable). The UI also offers browser **Speak** (Web Speech API) and keeps URLs in session storage across turns — multi-step state, not a single-shot FAQ.

Why this for the Alexa+ track: Amazon’s creative guidance favors multi-step orchestration and state across a session. The product is verification — “don’t trust the agent’s claim that work is done.” The dark conversational panel is meant to feel like chatting with an Alexa+-style assistant, without requiring a physical Echo or a live MCP hook to Alexa.

Self-check: auditing Encore (`encore-rouge-chi.vercel.app` + `qinheyi/encore`) returns **almost** with a clear “record a &lt;3 min demo” fix when no video is provided — that is the intended judge path. Use the **Try Encore** and **Audit Entry Gate** chips on the live demo.

Out of scope on purpose: no Fire TV / Bee / Ring hardware, no Echo skill certification — the rules allow a simulated Alexa+ experience with any agentic stack.

### How it works / Inspiration

Hackathon submissions fail for boring reasons: dead demos, private repos, missing licenses, overlong videos. Entry Gate turns those checks into one conversational audit so a builder (or an agent) can fix the list before Submit.

### Challenges

Deterministic scoring had to stay trustworthy when the LLM is offline; MiniMax narration is optional. GitHub checks use the public HTTP API so the deployed demo works without a server-side `gh` login. YouTube oEmbed omits duration, so the checklist must warn instead of guessing.

### Accomplishments

- Live demo + public MIT repo  
- Tool-verified audit path (demo soft-fail sniff, repo README quality, video, checklist)  
- Alexa+-style UX: session memory, example chips, Speak, follow-up prompts  
- Works without MiniMax; better spoken summary with it  

### What’s next

Ship the demo video; paste product feedback + friction logs on Devpost; optional contest rule packs beyond Devpost-shaped defaults; optional Bedrock/AgentCore if free-tier credits appear.

---

## Product feedback (required on Devpost)

Paste or adapt the following into the product-feedback field:

**Tools used:** Next.js 15 (App Router), Vercel hosting, MiniMax OpenAI-compatible chat API (`api.minimax.cn`), GitHub public REST API, YouTube/Vimeo oEmbed, browser Web Speech API. No Alexa device SDK — simulated Alexa+ experience path.

**What worked well:** Vercel deploy from GitHub was fast; Next.js App Router + Route Handlers made a clean tool loop (`/api/audit`); public GitHub API is enough for LICENSE/README checks without embedding a token in the demo; MiniMax works as a drop-in narration layer when the model name is correct.

**What needs work / friction:** (1) MiniMax model naming is easy to misconfigure in Vercel env (a malformed `MINIMAX_MODEL` value breaks narration while deterministic scoring still works — we added sanitization). (2) YouTube oEmbed does not return duration, so &lt;3 min checks are incomplete without a second API. (3) Alexa+ simulated path is clear in the rules, but discoverability of “what good simulation looks like” for judges could be stronger (official sample UX patterns would help).

**Onboarding:** From zero to public demo was same-day with Next.js + Vercel. Would build again for agentic web simulations; would try Streamable HTTP MCP if a free sandbox appeared.

**Would you build with these again?** Yes for Next.js/Vercel/GitHub API; yes for MiniMax as optional narration; interested in first-party Alexa+ MCP samples for a future non-simulated path.

---

## Friction log (optional, up to +10%)

### Entry 1 — YouTube duration via oEmbed
- **Task:** Verify demo video is ≤180 seconds for Devpost/Alexa+ rules.  
- **Steps:** Call YouTube oEmbed with the public watch URL; read `duration`.  
- **Expected:** Duration in seconds (as Vimeo oEmbed provides).  
- **Actual:** Title/author only; `duration` absent.  
- **Severity:** Important (blocks a hard pass/fail on video length).  
- **Workaround:** Mark duration as “unknown” and warn the builder to confirm manually.  
- **Suggestion:** Document that YouTube oEmbed omits duration, or provide a recommended free duration API for hackathon demos.

### Entry 2 — MiniMax model env on Vercel
- **Task:** Enable spoken LLM summary on production.  
- **Steps:** Set `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL` as Vercel secrets; redeploy; call `/api/audit`.  
- **Expected:** Narration with model `MiniMax-M3`.  
- **Actual:** HTTP 400 `unknown model 'minimax_model=minimax-m3'` when the secret value was malformed.  
- **Severity:** Important (silent degrade to rules-only summary).  
- **Workaround:** Sanitize env (`minimax_model=…` → `MiniMax-M3`); re-set secret; redeploy.  
- **Suggestion:** Provider should reject or normalize obvious key=value mistakes in the model field with a clearer error.

---

## Remaining steps checklist

- [ ] Devpost UI: create/save project draft (browser login as qinheyi267)  
- [ ] Screenshots for gallery (empty chat, Encore almost, Speak/follow-up)  
- [ ] User: upload &lt;3 min YouTube or Vimeo (public) per `DEMO_VIDEO_SCRIPT.md`  
- [ ] Paste video URL; re-run Entry Gate on itself  
- [ ] Paste product feedback + friction logs above  
- [ ] Submit before **2026-10-24 03:00 Beijing** (= 10-23 12:00 PDT)

## Links

- Contest: https://amazonappdev2026.devpost.com/  
- Demo: https://entry-gate.vercel.app  
- Repo: https://github.com/qinheyi/entry-gate  
