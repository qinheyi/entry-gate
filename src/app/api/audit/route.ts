import { NextResponse } from "next/server";
import { runAudit } from "@/lib/entrygate/agent";
import { AuditRequest } from "@/lib/entrygate/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = AuditRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Normalize empty optional URLs
  const data = {
    ...parsed.data,
    demoUrl: parsed.data.demoUrl || undefined,
    repoUrl: parsed.data.repoUrl || undefined,
    videoUrl: parsed.data.videoUrl || undefined,
  };

  try {
    const result = await runAudit(data);
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message || "Audit failed";
    console.error("audit error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
