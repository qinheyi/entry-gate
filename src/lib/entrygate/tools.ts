/**
 * Entry Gate tools — real HTTP / GitHub / oEmbed where possible, graceful mocks otherwise.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChecklistItem, ToolTrace, Verdict } from "./types";

const execFileAsync = promisify(execFile);

function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

export async function fetchPage(url: string): Promise<ToolTrace> {
  const args = { url };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          "user-agent": "EntryGateBot/0.1 (+https://github.com/qinheyi/entry-gate)",
          accept: "text/html,application/xhtml+xml,*/*",
        },
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
    const finalUrl = res.url || url;
    const ctype = res.headers.get("content-type") || "";
    let title = "";
    if (ctype.includes("text/html") || ctype.includes("application/xhtml")) {
      const text = await res.text();
      const m = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      title = m ? truncate(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"), 120) : "";
    }
    const ok = res.status >= 200 && res.status < 400;
    return {
      name: "fetch_page",
      args,
      ok,
      summary: ok
        ? `HTTP ${res.status}${title ? ` — "${title}"` : ""} (${finalUrl})`
        : `HTTP ${res.status} for ${finalUrl}`,
      raw: { status: res.status, finalUrl, title, contentType: ctype },
    };
  } catch (e) {
    return {
      name: "fetch_page",
      args,
      ok: false,
      summary: `fetch failed: ${(e as Error).message}`,
      raw: { error: (e as Error).message },
    };
  }
}

function parseRepo(input: string): { owner: string; repo: string } | null {
  const s = input.trim();
  const m1 = s.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (m1) return { owner: m1[1], repo: m1[2].replace(/\.git$/, "") };
  const m2 = s.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (m2) return { owner: m2[1], repo: m2[2].replace(/\.git$/, "") };
  return null;
}

async function ghApiJson(path: string): Promise<unknown | null> {
  try {
    const { stdout } = await execFileAsync("gh", ["api", path], {
      timeout: 15_000,
      maxBuffer: 2_000_000,
      env: process.env,
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function publicGithubJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "EntryGateBot/0.1",
        "x-github-api-version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function checkRepo(repoInput: string): Promise<ToolTrace> {
  const args = { repo: repoInput };
  const parsed = parseRepo(repoInput);
  if (!parsed) {
    return {
      name: "check_repo",
      args,
      ok: false,
      summary: "Could not parse owner/repo (expected owner/repo or https://github.com/owner/repo)",
    };
  }
  const { owner, repo } = parsed;
  const path = `/repos/${owner}/${repo}`;

  let data = (await ghApiJson(path)) as Record<string, unknown> | null;
  let source = "gh";
  if (!data) {
    data = (await publicGithubJson(path)) as Record<string, unknown> | null;
    source = "http";
  }

  if (!data || typeof data !== "object") {
    // Graceful mock fallback when GitHub is unreachable
    return {
      name: "check_repo",
      args: { ...args, owner, repo },
      ok: false,
      summary: `Mock fallback: could not reach GitHub for ${owner}/${repo}`,
      raw: {
        mock: true,
        public: null,
        license: null,
        hasReadme: null,
        pushed_at: null,
        source: "mock",
      },
    };
  }

  const isPrivate = Boolean(data.private);
  const license =
    data.license && typeof data.license === "object"
      ? String((data.license as { spdx_id?: string; key?: string }).spdx_id ||
          (data.license as { key?: string }).key ||
          "unknown")
      : null;
  const pushed_at = typeof data.pushed_at === "string" ? data.pushed_at : null;
  const defaultBranch = typeof data.default_branch === "string" ? data.default_branch : "main";

  // README presence
  let hasReadme = false;
  const readmePath = `/repos/${owner}/${repo}/readme`;
  const readme =
    (await ghApiJson(readmePath)) ||
    (await publicGithubJson(readmePath));
  if (readme && typeof readme === "object") hasReadme = true;
  // Also try contents listing as soft check
  if (!hasReadme) {
    const contents =
      ((await ghApiJson(`/repos/${owner}/${repo}/contents`)) as unknown[]) ||
      ((await publicGithubJson(`/repos/${owner}/${repo}/contents`)) as unknown[]);
    if (Array.isArray(contents)) {
      hasReadme = contents.some((f) => {
        const name = (f as { name?: string }).name || "";
        return /^readme(\.|$)/i.test(name);
      });
    }
  }

  const ok = !isPrivate;
  return {
    name: "check_repo",
    args: { ...args, owner, repo },
    ok,
    summary: [
      isPrivate ? "private" : "public",
      license ? `license=${license}` : "no license",
      hasReadme ? "README present" : "no README",
      pushed_at ? `pushed_at=${pushed_at}` : "no push date",
      `via ${source}`,
    ].join("; "),
    raw: {
      mock: false,
      public: !isPrivate,
      private: isPrivate,
      license,
      hasReadme,
      pushed_at,
      defaultBranch,
      html_url: data.html_url,
      description: data.description,
      source,
    },
  };
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") return parts[1] || null;
    }
  } catch { /* ignore */ }
  return null;
}

function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts.find((p) => /^\d+$/.test(p));
    return id || null;
  } catch {
    return null;
  }
}

export async function checkVideoMeta(url: string): Promise<ToolTrace> {
  const args = { url };
  const yt = youtubeId(url);
  const vm = vimeoId(url);

  if (!yt && !vm) {
    return {
      name: "check_video_meta",
      args,
      ok: false,
      summary: "URL is not a recognized YouTube or Vimeo link",
      raw: { platform: null },
    };
  }

  const oembed = yt
    ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;

  try {
    const res = await fetch(oembed, {
      headers: { "user-agent": "EntryGateBot/0.1", accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        name: "check_video_meta",
        args,
        ok: false,
        summary: `oEmbed HTTP ${res.status} (${yt ? "YouTube" : "Vimeo"})`,
        raw: { platform: yt ? "youtube" : "vimeo", status: res.status },
      };
    }
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      duration?: number;
      thumbnail_url?: string;
      type?: string;
    };
    // YouTube oEmbed does not include duration; Vimeo does.
    const durationSec =
      typeof data.duration === "number"
        ? data.duration
        : yt
          ? null // unknown from oEmbed
          : null;
    const under3min =
      durationSec == null ? null : durationSec > 0 && durationSec <= 180;
    const title = data.title ? truncate(data.title, 100) : "";
    return {
      name: "check_video_meta",
      args,
      ok: true,
      summary: [
        yt ? "YouTube" : "Vimeo",
        title ? `"${title}"` : "",
        durationSec != null ? `${durationSec}s` : "duration unknown (oEmbed)",
        under3min === true ? "≤3 min ✓" : under3min === false ? ">3 min ✗" : "",
      ]
        .filter(Boolean)
        .join(" — "),
      raw: {
        platform: yt ? "youtube" : "vimeo",
        title: data.title,
        author: data.author_name,
        durationSec,
        under3min,
        note:
          yt && durationSec == null
            ? "YouTube oEmbed omits duration; treat as unknown"
            : undefined,
      },
    };
  } catch (e) {
    return {
      name: "check_video_meta",
      args,
      ok: false,
      summary: `oEmbed failed: ${(e as Error).message}`,
      raw: { error: (e as Error).message, mock: true },
    };
  }
}

export function scoreChecklist(input: {
  demo?: ToolTrace;
  repo?: ToolTrace;
  video?: ToolTrace;
  message?: string;
}): { verdict: Verdict; score: number; checklist: ChecklistItem[]; fixes: string[] } {
  const items: ChecklistItem[] = [];
  const fixes: string[] = [];

  // Demo URL
  if (!input.demo) {
    items.push({
      id: "demo",
      label: "Live demo URL",
      status: "fail",
      detail: "No demo URL provided",
      priority: 1,
    });
    fixes.push("Paste a public live demo URL (Vercel/other) that judges can open.");
  } else {
    const status = (input.demo.raw as { status?: number } | undefined)?.status;
    const ok = input.demo.ok && typeof status === "number" && status >= 200 && status < 400;
    items.push({
      id: "demo",
      label: "Live demo URL reachable",
      status: ok ? "pass" : "fail",
      detail: input.demo.summary,
      priority: 1,
    });
    if (!ok) fixes.push("Fix or publish the demo URL so it returns HTTP 2xx/3xx.");
  }

  // Repo
  if (!input.repo) {
    items.push({
      id: "repo",
      label: "GitHub repository",
      status: "fail",
      detail: "No repo URL provided",
      priority: 1,
    });
    fixes.push("Add a public GitHub repo URL (owner/repo).");
  } else {
    const raw = (input.repo.raw || {}) as {
      mock?: boolean;
      public?: boolean | null;
      license?: string | null;
      hasReadme?: boolean | null;
      pushed_at?: string | null;
    };
    if (raw.mock) {
      items.push({
        id: "repo_public",
        label: "Repository public",
        status: "warn",
        detail: "GitHub unreachable — could not verify (mock)",
        priority: 2,
      });
      fixes.push("Re-run when GitHub is reachable, or confirm the repo is public.");
    } else {
      const isPublic = raw.public === true;
      items.push({
        id: "repo_public",
        label: "Repository is public",
        status: isPublic ? "pass" : "fail",
        detail: input.repo.summary,
        priority: 1,
      });
      if (!isPublic) fixes.push("Make the GitHub repository public (or grant judge access).");

      items.push({
        id: "repo_license",
        label: "LICENSE present",
        status: raw.license ? "pass" : "warn",
        detail: raw.license ? `Detected ${raw.license}` : "No license file detected via API",
        priority: 2,
      });
      if (!raw.license) fixes.push("Add an open-source LICENSE (MIT recommended for this hackathon).");

      items.push({
        id: "repo_readme",
        label: "README present",
        status: raw.hasReadme ? "pass" : "fail",
        detail: raw.hasReadme ? "README found" : "No README detected",
        priority: 1,
      });
      if (!raw.hasReadme) fixes.push("Add a README with setup, env vars, and what the project does.");

      if (raw.pushed_at) {
        const ageDays = (Date.now() - new Date(raw.pushed_at).getTime()) / 86_400_000;
        items.push({
          id: "repo_fresh",
          label: "Recent push",
          status: ageDays <= 30 ? "pass" : "warn",
          detail: `Last push ${raw.pushed_at} (~${Math.round(ageDays)}d ago)`,
          priority: 3,
        });
        if (ageDays > 30) fixes.push("Push a fresh commit so judges see recent activity.");
      }
    }
  }

  // Video (optional but recommended for Devpost)
  if (!input.video) {
    items.push({
      id: "video",
      label: "Demo video (YouTube/Vimeo)",
      status: "warn",
      detail: "No video URL — required for many Devpost submits including Alexa+",
      priority: 2,
    });
    fixes.push("Record a <3 min demo and upload to YouTube or Vimeo.");
  } else {
    const raw = (input.video.raw || {}) as {
      under3min?: boolean | null;
      durationSec?: number | null;
      platform?: string | null;
    };
    if (!input.video.ok) {
      items.push({
        id: "video",
        label: "Demo video metadata",
        status: "fail",
        detail: input.video.summary,
        priority: 2,
      });
      fixes.push("Use a public YouTube or Vimeo URL judges can open.");
    } else {
      let status: ChecklistItem["status"] = "pass";
      let detail = input.video.summary;
      if (raw.under3min === false) {
        status = "fail";
        detail += " — over 3 minutes";
        fixes.push("Trim the demo video to under 3 minutes.");
      } else if (raw.under3min == null) {
        status = "warn";
        detail += " — duration not verified via oEmbed";
        fixes.push("Confirm the video is under 3 minutes (YouTube oEmbed omits duration).");
      }
      items.push({
        id: "video",
        label: "Demo video (≤3 min)",
        status,
        detail,
        priority: 2,
      });
    }
  }

  // Soft: user asked readiness
  const msg = (input.message || "").toLowerCase();
  if (/ready|submit|audit|check/.test(msg)) {
    items.push({
      id: "intent",
      label: "Submission readiness ask",
      status: "pass",
      detail: "User requested a submit-readiness audit",
      priority: 5,
    });
  }

  // Score
  let score = 100;
  for (const it of items) {
    if (it.status === "fail") score -= it.priority <= 1 ? 25 : 15;
    else if (it.status === "warn") score -= 8;
  }
  score = Math.max(0, Math.min(100, score));

  const hasHardFail = items.some((i) => i.status === "fail" && i.priority <= 1);
  const hasAnyFail = items.some((i) => i.status === "fail");
  const hasWarn = items.some((i) => i.status === "warn");

  let verdict: Verdict;
  if (hasHardFail || score < 55) verdict = "no-go";
  else if (hasAnyFail || hasWarn || score < 85) verdict = "almost";
  else verdict = "go";

  // Rank fixes by checklist priority
  const ranked = [...fixes];
  return { verdict, score, checklist: items, fixes: ranked };
}
