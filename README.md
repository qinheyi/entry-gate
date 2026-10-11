# Entry Gate

Simulated **Alexa+** submission-steward agent for the [Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/) (Alexa+ track).

Paste a live demo URL, GitHub repo, and optional YouTube/Vimeo link, then ask **“Am I ready to submit?”** Entry Gate runs verification tools and returns a **go / almost / no-go** with ranked fixes — in a dark chat UI that mimics an Alexa+ conversation.

Built by **Qin HEYI** &lt;qinheyi@agentmail.to&gt;. MIT licensed.

## What it does

1. **fetch_page** — GET the demo URL; report HTTP status + HTML title.
2. **check_repo** — Resolve `owner/repo` via `gh api` (if logged in) or the public GitHub HTTP API: public?, license, README, `pushed_at`.
3. **check_video_meta** — YouTube/Vimeo oEmbed (title; duration when the provider returns it). Flag &gt;3 minutes when known.
4. **score_checklist** — Deterministic rubric → verdict + ranked fixes.
5. Optional **MiniMax** narration for a spoken-style summary (falls back to rules if the key is missing or the call fails).

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- MiniMax OpenAI-compatible API (`https://api.minimax.cn/v1`, model `MiniMax-M3`)
- Deploy target: Vercel

## Setup

```bash
cd app
cp .env.example .env.local   # optional: add MINIMAX_API_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `MINIMAX_API_KEY` | No | If set, enables short LLM narration after scoring |
| `MINIMAX_BASE_URL` | No | Default `https://api.minimax.cn/v1` |
| `MINIMAX_MODEL` | No | Default `MiniMax-M3` |
| `MINIMAX_THINKING` | No | Set `adaptive` to allow thinking; default disabled on M3 |
| `ENTRY_GATE_LLM` | No | Set `0` to force deterministic mode even with a key |
| `LLM_TIMEOUT_MS` | No | Default `60000` |

Without a key, Entry Gate still returns a full structured audit.

## API

`POST /api/audit`

```json
{
  "message": "Am I ready to submit?",
  "demoUrl": "https://example.vercel.app",
  "repoUrl": "qinheyi/entry-gate",
  "videoUrl": "https://www.youtube.com/watch?v=..."
}
```

## Scripts

```bash
npm run dev
npm run build
npm start
```

## License

MIT — Copyright (c) 2026 Qin HEYI &lt;qinheyi@agentmail.to&gt;
