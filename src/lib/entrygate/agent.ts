import { chatCompletion, llmEnabled } from "./llm";
import { checkRepo, checkVideoMeta, fetchPage, scoreChecklist } from "./tools";
import type { AuditRequest, AuditResult, ToolTrace, Verdict } from "./types";

function spokenFallback(verdict: Verdict, score: number, fixes: string[]): string {
  const head =
    verdict === "go"
      ? `You're clear to submit. Score ${score} out of 100.`
      : verdict === "almost"
        ? `Almost ready — score ${score} out of 100. A few fixes before you hit Submit.`
        : `Not ready yet — score ${score} out of 100. Blockers need attention first.`;
  const top = fixes.slice(0, 3);
  if (!top.length) return head + " Checklist looks solid.";
  return `${head} Top fixes: ${top.map((f, i) => `${i + 1}. ${f}`).join(" ")}`;
}

export async function runAudit(req: AuditRequest): Promise<AuditResult> {
  const tools: ToolTrace[] = [];
  const demoUrl = (req.demoUrl || "").trim();
  const repoUrl = (req.repoUrl || "").trim();
  const videoUrl = (req.videoUrl || "").trim();

  // Run tools in parallel where independent
  const jobs: Promise<void>[] = [];
  let demo: ToolTrace | undefined;
  let repo: ToolTrace | undefined;
  let video: ToolTrace | undefined;

  if (demoUrl) {
    jobs.push(
      fetchPage(demoUrl).then((t) => {
        demo = t;
        tools.push(t);
      }),
    );
  }
  if (repoUrl) {
    jobs.push(
      checkRepo(repoUrl).then((t) => {
        repo = t;
        tools.push(t);
      }),
    );
  }
  if (videoUrl) {
    jobs.push(
      checkVideoMeta(videoUrl).then((t) => {
        video = t;
        tools.push(t);
      }),
    );
  }
  await Promise.all(jobs);

  const scored = scoreChecklist({ demo, repo, video, message: req.message });
  tools.push({
    name: "score_checklist",
    args: {
      hasDemo: Boolean(demoUrl),
      hasRepo: Boolean(repoUrl),
      hasVideo: Boolean(videoUrl),
    },
    ok: true,
    summary: `verdict=${scored.verdict} score=${scored.score} items=${scored.checklist.length}`,
    raw: { verdict: scored.verdict, score: scored.score },
  });

  let summary = spokenFallback(scored.verdict, scored.score, scored.fixes);
  let llmUsed = false;
  let llmError: string | undefined;

  if (llmEnabled()) {
    try {
      const brief = {
        verdict: scored.verdict,
        score: scored.score,
        checklist: scored.checklist.map((c) => ({
          id: c.id,
          status: c.status,
          label: c.label,
          detail: c.detail,
        })),
        fixes: scored.fixes.slice(0, 5),
        userMessage: req.message,
      };
      const result = await chatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are Entry Gate, a simulated Alexa+ submission steward. Speak in concise, warm spoken English (2–4 short sentences), as if answering aloud. Lead with the go/almost/no-go verdict and score, then the top one or two fixes. Mention product-feedback or friction-log tips only if they appear in fixes. Do not invent facts not in the JSON. No markdown, no bullet lists.",
          },
          {
            role: "user",
            content: `Narrate this audit for the builder:\n${JSON.stringify(brief)}`,
          },
        ],
        maxTokens: 280,
        timeoutMs: 45_000,
      });
      if (result.text) {
        summary = result.text;
        llmUsed = true;
      }
    } catch (e) {
      llmError = (e as Error).message;
    }
  }

  return {
    verdict: scored.verdict,
    summary,
    score: scored.score,
    checklist: scored.checklist,
    fixes: scored.fixes,
    tools,
    llmUsed,
    llmError,
  };
}
