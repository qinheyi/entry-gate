"use client";

import { useEffect, useRef, useState } from "react";

type Verdict = "go" | "almost" | "no-go";

interface ChecklistItem {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn" | "skip";
  detail: string;
  priority: number;
}

interface ToolTrace {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
}

interface AuditResult {
  verdict: Verdict;
  summary: string;
  score: number;
  checklist: ChecklistItem[];
  fixes: string[];
  tools: ToolTrace[];
  llmUsed: boolean;
  llmError?: string;
}

interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  audit?: AuditResult;
}

const STORAGE_KEY = "entry-gate-session-v1";

const WELCOME =
  "Hi — I'm Entry Gate, your Alexa+-style submission steward. Paste a live demo URL and GitHub repo (optional video), then ask \"Am I ready to submit?\" I'll probe the links and give you a go / almost / no-go — with ranked fixes and a spoken summary.";

const EXAMPLES = [
  {
    label: "Try Encore",
    demoUrl: "https://encore-rouge-chi.vercel.app",
    repoUrl: "qinheyi/encore",
    videoUrl: "",
    message: "Am I ready to submit?",
  },
  {
    label: "Audit Entry Gate",
    demoUrl: "https://entry-gate.vercel.app",
    repoUrl: "qinheyi/entry-gate",
    videoUrl: "",
    message: "Am I ready to submit?",
  },
];

function verdictColor(v: Verdict) {
  if (v === "go") return "text-go border-go/40 bg-go/10";
  if (v === "almost") return "text-almost border-almost/40 bg-almost/10";
  return "text-nogo border-nogo/40 bg-nogo/10";
}

function statusDot(s: ChecklistItem["status"]) {
  if (s === "pass") return "bg-go";
  if (s === "warn") return "bg-almost";
  if (s === "fail") return "bg-nogo";
  return "bg-muted";
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export default function Chat() {
  const [demoUrl, setDemoUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [input, setInput] = useState("Am I ready to submit?");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "welcome", role: "assistant", text: WELCOME },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Restore last session (Alexa+ multi-turn state)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          demoUrl?: string;
          repoUrl?: string;
          videoUrl?: string;
        };
        if (parsed.demoUrl) setDemoUrl(parsed.demoUrl);
        if (parsed.repoUrl) setRepoUrl(parsed.repoUrl);
        if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ demoUrl, repoUrl, videoUrl }),
      );
    } catch {
      /* ignore */
    }
  }, [demoUrl, repoUrl, videoUrl, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function runAudit(message: string, urls?: { demoUrl?: string; repoUrl?: string; videoUrl?: string }) {
    const d = urls?.demoUrl ?? demoUrl;
    const r = urls?.repoUrl ?? repoUrl;
    const v = urls?.videoUrl ?? videoUrl;
    if (!message.trim() || busy) return;
    setBusy(true);
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: [
        message,
        d && `Demo: ${d}`,
        r && `Repo: ${r}`,
        v && `Video: ${v}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
    setMsgs((m) => [...m, userMsg]);
    setInput("");

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          demoUrl: d || undefined,
          repoUrl: r || undefined,
          videoUrl: v || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsgs((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            text: `Sorry — audit failed: ${data.error || res.status}`,
          },
        ]);
      } else {
        const audit = data as AuditResult;
        setMsgs((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: audit.summary,
            audit,
          },
        ]);
      }
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: `Network error: ${(e as Error).message}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function applyExample(ex: (typeof EXAMPLES)[number], autoRun: boolean) {
    setDemoUrl(ex.demoUrl);
    setRepoUrl(ex.repoUrl);
    setVideoUrl(ex.videoUrl);
    setInput(ex.message);
    if (autoRun) {
      void runAudit(ex.message, {
        demoUrl: ex.demoUrl,
        repoUrl: ex.repoUrl,
        videoUrl: ex.videoUrl,
      });
    }
  }

  const lastAudit = [...msgs].reverse().find((m) => m.audit)?.audit;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 ${
                busy ? "animate-ping" : ""
              }`}
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">
            Alexa+ simulation · {busy ? "listening…" : "ready"}
          </p>
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Entry Gate</h1>
        <p className="mt-2 text-sm text-muted">
          Submission steward agent — verifies demo, repo, and video before you hit Submit.
          Session URLs persist in this browser.
        </p>
      </header>

      <section className="mb-3 grid gap-3 rounded-2xl border border-border bg-card/80 p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Demo URL
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            placeholder="https://your-demo.vercel.app"
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          GitHub repo
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            placeholder="owner/repo or URL"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Video (optional)
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            placeholder="YouTube / Vimeo URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </label>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            disabled={busy}
            onClick={() => applyExample(ex, true)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-foreground disabled:opacity-40"
          >
            {ex.label}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setDemoUrl("");
            setRepoUrl("");
            setVideoUrl("");
            setMsgs([{ id: "welcome", role: "assistant", text: WELCOME }]);
          }}
          className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-foreground disabled:opacity-40"
        >
          Clear session
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-accent/20 text-foreground"
                : "mr-auto bg-card border border-border text-foreground"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.audit && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${verdictColor(
                      m.audit.verdict,
                    )}`}
                  >
                    {m.audit.verdict} · {m.audit.score}/100
                    {m.audit.llmUsed ? " · LLM" : " · rules"}
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(m.audit!.summary)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
                    title="Speak summary (browser TTS)"
                  >
                    Speak
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {m.audit.checklist.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 text-xs text-muted">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDot(c.status)}`} />
                      <span>
                        <span className="text-foreground">{c.label}</span> — {c.detail}
                      </span>
                    </li>
                  ))}
                </ul>
                {m.audit.fixes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-foreground">Ranked fixes</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-muted">
                      {m.audit.fixes.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer text-foreground/80">Tool trace</summary>
                  <ul className="mt-2 space-y-1 font-mono">
                    {m.audit.tools.map((t, i) => (
                      <li key={i}>
                        {t.ok ? "✓" : "✗"} {t.name}: {t.summary}
                      </li>
                    ))}
                  </ul>
                  {m.audit.llmError && (
                    <p className="mt-2 text-nogo">LLM fallback: {m.audit.llmError}</p>
                  )}
                </details>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Checking links…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {lastAudit && lastAudit.fixes.length > 0 && !busy && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="self-center text-xs text-muted">Follow-up:</span>
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
            onClick={() => {
              setInput("What should I fix first?");
              void runAudit("What should I fix first?");
            }}
          >
            What should I fix first?
          </button>
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
            onClick={() => {
              setInput("Re-audit after my fixes");
              void runAudit("Re-audit after my fixes");
            }}
          >
            Re-audit
          </button>
        </div>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void runAudit(input.trim());
        }}
      >
        <input
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ask e.g. "Am I ready to submit?"'
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
