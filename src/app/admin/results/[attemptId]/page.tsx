"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useParams } from "next/navigation";
import StatusBadge from "@/components/admin/StatusBadge";

export default function AdminAttemptDetails() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const stateQ = useQuery({
    queryKey: ["admin", "attempt", attemptId, "state"],
    enabled: !!attemptId,
    queryFn: async () => {
      const res = await authFetch(`/api/admin/attempts/${attemptId}/state`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load attempt state failed");
      return j;
    },
  });

  const metaQ = useQuery({
    queryKey: ["admin", "attempt", attemptId, "meta"],
    enabled: !!attemptId,
    queryFn: async () => {
      const res = await authFetch(`/api/admin/attempts/${attemptId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load attempt meta failed");
      return j.item as any;
    },
  });

  const actQ = useQuery({
    queryKey: ["admin", "attempt", attemptId, "activity"],
    enabled: !!attemptId,
    queryFn: async () => {
      const res = await authFetch(`/api/admin/attempts/${attemptId}/activity?limit=500`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load activity failed");
      return Array.isArray(j?.items) ? j.items : [];
    },
  });

  if (!attemptId) {
    return (
      <div className="space-y-4">
        <div className="p-3">Loading…</div>
      </div>
    );
  }

  // Helpers for formatting device info
  const fmtBool = (v: any) => (v === true ? "Yes" : v === false ? "No" : "-");
  const fmtPct = (v: any) => (typeof v === "number" ? `${v}%` : "-");
  const fmtNum = (v: any, d = 0) => (typeof v === "number" ? v.toFixed(d) : "-");
  const fmtBytes = (b: any) => {
    const n = typeof b === "number" ? b : NaN;
    if (!isFinite(n) || n < 0) return "-";
    const gb = n / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = n / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = n / 1024;
    if (kb >= 1) return `${kb.toFixed(0)} KB`;
    return `${n} B`;
  };
  const joinBrands = (brands: any) =>
    Array.isArray(brands)
      ? brands
          .map((b: any) => `${b.brand || b.brandName || "Brand"} ${b.version || b.versionName || ""}`.trim())
          .join(", ")
      : "-";
  const pick = (v: any) => (v === null || v === undefined || v === "" ? "-" : String(v));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Attempt Details</h1>
        <span className="text-xs font-mono border rounded px-2 py-1">{attemptId}</span>
        <div className="ml-auto">
          <Link href="/admin/results" className="border px-3 py-2 rounded">Back to Results</Link>
        </div>
      </div>

      {(stateQ.isLoading || metaQ.isLoading) && <div className="p-3">Loading…</div>}
      {(stateQ.error || metaQ.error) && (
        <div className="p-3 text-red-600">{String(((stateQ.error || metaQ.error) as any)?.message)}</div>
      )}

      {metaQ.data && (
        <div className="bg-white border rounded p-3">
          <h2 className="font-semibold mb-2">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div><span className="text-gray-600">Student:</span> {metaQ.data.student_name ?? "-"}</div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Status:</span>
              {(() => {
                const status = (metaQ.data.completion_status ?? "in_progress") as "in_progress" | "submitted" | "abandoned" | "invalid";
                return <StatusBadge status={status} size="sm" />;
              })()}
            </div>
            <div><span className="text-gray-600">Started:</span> {metaQ.data.started_at ?? "-"}</div>
            <div><span className="text-gray-600">Submitted:</span> {metaQ.data.submitted_at ?? "-"}</div>
            <div><span className="text-gray-600">Latest IP:</span> {metaQ.data.ip_address ?? "-"}</div>
          </div>
          {Array.isArray(metaQ.data.ips) && metaQ.data.ips.length > 0 && (
            <div className="mt-3">
              <div className="text-sm text-gray-600">IP history</div>
              <ul className="text-xs mt-1 list-disc pl-5">
                {metaQ.data.ips.map((ip: any, i: number) => (
                  <li key={i}>{ip.created_at}: {ip.ip_address}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {metaQ.data?.device_info && (() => {
        const di: any = metaQ.data.device_info || {};
        const parsed = di?.parsed || {};
        const browser = parsed.browser || {};
        const os = parsed.os || {};
        const device = parsed.device || {};
        const s = di?.screen || {};
        const vp = di?.viewport || {};
        const ori = di?.orientation || {};
        const uaData = di?.uaData || {};
        const net = di?.network || {};
        const bat = di?.battery || {};
        const stor = di?.storage || {};
        const gpu = di?.gpu || {};
        const oem = di?.oem || {};
        const sub = di?.entrySubmit || {};

        const tzStr = (() => {
          const tz = di?.timezone;
          const off = typeof di?.timezoneOffset === "number" ? di.timezoneOffset : null; // minutes
          if (off === null) return pick(tz);
          const hours = -off / 60; // JS offset is minutes behind UTC
          const sign = hours >= 0 ? "+" : "";
          const h = Math.trunc(hours);
          const m = Math.round(Math.abs(hours - h) * 60);
          const hh = `${sign}${String(Math.abs(h)).padStart(2, "0")}`;
          const mm = `:${String(m).padStart(2, "0")}`;
          return `${pick(tz)} (UTC${hh}${mm})`;
        })();

        return (
          <div className="bg-white border rounded p-3">
            <h2 className="font-semibold mb-2">Device Info</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div><span className="text-gray-600">Browser:</span> {([browser.name, browser.version].filter(Boolean).join(" ")) || "-"}</div>
              <div><span className="text-gray-600">OS:</span> {([os.name, os.version].filter(Boolean).join(" ")) || "-"}</div>
              <div><span className="text-gray-600">Device Type:</span> {pick(device.type ?? (uaData?.mobile === true ? "mobile" : null))}</div>
              <div><span className="text-gray-600">Device Brand:</span> {pick(oem?.brand)}</div>
              <div><span className="text-gray-600">Device Model:</span> {pick(oem?.model)}</div>
              <div><span className="text-gray-600">Submit Clicks:</span> {pick(sub?.count)}</div>
              <div><span className="text-gray-600">First Click At:</span> {pick(sub?.firstAt)}</div>
              <div><span className="text-gray-600">Last Click At:</span> {pick(sub?.lastAt)}</div>

              <div><span className="text-gray-600">Language:</span> {pick(di?.language)}</div>
              <div><span className="text-gray-600">Languages:</span> {Array.isArray(di?.languages) ? di.languages.join(", ") : "-"}</div>
              <div><span className="text-gray-600">Timezone:</span> {tzStr}</div>

              <div><span className="text-gray-600">Screen:</span> {s.width && s.height ? `${s.width}x${s.height}` : "-"}</div>
              <div><span className="text-gray-600">Viewport:</span> {vp?.width && vp?.height ? `${vp.width}x${vp.height}` : "-"}</div>
              <div><span className="text-gray-600">Orientation:</span> {ori?.type || "-"}{typeof ori?.angle === "number" ? ` (${ori.angle}°)` : ""}</div>

              <div><span className="text-gray-600">Pixel Ratio:</span> {pick(di?.pixelRatio)}</div>
              <div><span className="text-gray-600">Color Depth:</span> {pick(s?.colorDepth)}</div>
              <div><span className="text-gray-600">Pixel Depth:</span> {pick(s?.pixelDepth)}</div>

              <div><span className="text-gray-600">CPU Threads:</span> {pick(di?.hardwareConcurrency)}</div>
              <div><span className="text-gray-600">Memory:</span> {typeof di?.deviceMemory === "number" ? `${di.deviceMemory} GB` : "-"}</div>
              <div><span className="text-gray-600">Touch:</span> {fmtBool(di?.touch)}</div>

              <div className="md:col-span-2"><span className="text-gray-600">GPU:</span> {gpu?.vendor || gpu?.renderer ? `${gpu.vendor || ""}${gpu.vendor && gpu.renderer ? " · " : ""}${gpu.renderer || ""}` : "-"}</div>
              <div><span className="text-gray-600">Network:</span> {net?.effectiveType || net?.type ? `${net.effectiveType || net.type}${typeof net.downlink === "number" ? ` · ${fmtNum(net.downlink, 1)} Mb/s` : ""}${typeof net.rtt === "number" ? ` · ${fmtNum(net.rtt)} ms` : ""}${typeof net.saveData === "boolean" ? ` · saveData ${fmtBool(net.saveData)}` : ""}` : "-"}</div>

              <div><span className="text-gray-600">Battery:</span> {(typeof bat?.level === "number" || typeof bat?.charging === "boolean") ? `${typeof bat.level === "number" ? fmtPct(bat.level) : ""}${typeof bat.level === "number" && typeof bat.charging === "boolean" ? " · " : ""}${typeof bat.charging === "boolean" ? (bat.charging ? "Charging" : "Not charging") : ""}` : "-"}</div>
              <div><span className="text-gray-600">Storage:</span> {stor?.usage || stor?.quota ? `${fmtBytes(stor.usage)} / ${fmtBytes(stor.quota)}` : "-"}</div>

              <div className="md:col-span-3"><span className="text-gray-600">UA-CH Brands:</span> {joinBrands(uaData?.brands)}</div>
              <div className="md:col-span-3"><span className="text-gray-600">User Agent:</span> {pick(di?.userAgent)}</div>
              <div><span className="text-gray-600">Platform (navigator):</span> {pick(di?.platform)}</div>
              <div><span className="text-gray-600">Vendor:</span> {pick(di?.vendor)}</div>
              <div><span className="text-gray-600">Collected At:</span> {pick(di?.collectedAt)}</div>
            </div>
            <details className="mt-3">
              <summary className="text-sm text-gray-600 cursor-pointer">Show raw JSON</summary>
              <pre className="text-xs whitespace-pre-wrap mt-2">{JSON.stringify(metaQ.data.device_info, null, 2)}</pre>
            </details>
          </div>
        );
      })()}

      {(() => {
        if (actQ.isLoading) return <div className="p-3">Loading activity…</div>;
        if (actQ.error)
          return (
            <div className="p-3 text-red-600">{String(((actQ.error as any)?.message))}</div>
          );
        const items = Array.isArray(actQ.data) ? (actQ.data as any[]) : [];
        return (
          <div className="bg-white border rounded p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold mb-2">Activity</h2>
              <span className="text-xs text-gray-500">{items.length} events</span>
            </div>
            {(() => {
              const counts = items.reduce((acc: Record<string, number>, ev: any) => {
                const k = String(ev?.event_type || "unknown");
                acc[k] = (acc[k] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const keys = Object.keys(counts).sort();
              return keys.length > 0 ? (
                <div className="text-xs text-gray-700 mb-2 flex flex-wrap gap-2">
                  {keys.map((k) => (
                    <span key={k} className="border rounded px-2 py-1">
                      {k}: {counts[k]}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
            {items.length === 0 ? (
              <div className="text-sm text-gray-600">No activity recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="p-2 border">Time</th>
                      <th className="p-2 border">Type</th>
                      <th className="p-2 border">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((ev: any, idx: number) => {
                      const t = ev?.event_time || ev?.created_at;
                      const when = t ? new Date(t).toLocaleString() : "-";
                      return (
                        <tr key={idx} className="border-t align-top">
                          <td className="p-2 border text-xs whitespace-nowrap">{when}</td>
                          <td className="p-2 border text-sm">{ev?.event_type || "-"}</td>
                          <td className="p-2 border text-xs">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(ev?.payload ?? {}, null, 2)}</pre>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {stateQ.data && (
        <div className="bg-white border rounded p-3">
          <h2 className="font-semibold mb-2">Per-question responses</h2>
          <PerQuestionTable state={stateQ.data} />
        </div>
      )}

      {stateQ.data && (
        <div className="bg-white border rounded p-3 overflow-auto">
          <div className="text-sm text-gray-600 mb-2">Raw state response</div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(stateQ.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function PerQuestionTable({ state }: { state: any }) {
  const answers = (state?.answers ?? {}) as Record<string, unknown>;
  const questions = Array.isArray(state?.questions) ? (state.questions as any[]) : [];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">Question</th>
            <th className="p-2 border">Type</th>
            <th className="p-2 border">Answer</th>
            <th className="p-2 border">Correct</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => {
            const ans = answers[q.id];
            const ok = isCorrect(q, ans);
            const hasAns = hasAnswer(q, ans);
            return (
              <tr key={q.id} className="border-t align-top">
                <td className="p-2 border text-sm max-w-xl">
                  <div className="font-medium line-clamp-2">{stripHtml(String(q.question_text ?? ""))}</div>
                  <div className="text-xs text-gray-500">{q.id}</div>
                </td>
                <td className="p-2 border text-sm">{q.question_type}</td>
                <td className="p-2 border text-sm whitespace-pre-wrap">{hasAns ? fmtAnswer(q, ans) : ""}</td>
                <td className="p-2 border text-sm">
                  {!hasAns
                    ? ""
                    : ok === null
                      ? <span className="text-gray-500">n/a</span>
                      : ok
                        ? <span className="text-green-700">✔</span>
                        : <span className="text-red-700">✘</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type QType = "true_false" | "single_choice" | "multiple_choice" | "multi_select" | "paragraph";
function isAutoGradable(t: QType) {
  return t === "true_false" || t === "single_choice" || t === "multiple_choice" || t === "multi_select";
}
function normStr(s: unknown) {
  return typeof s === "string" ? s.trim() : String(s ?? "");
}
function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => normStr(x));
}
function arraysEqualIgnoreOrder(a: unknown, b: unknown) {
  const aa = toStringArray(a).slice().sort();
  const bb = toStringArray(b).slice().sort();
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}
function isCorrect(question: any, answer: unknown): boolean | null {
  const t = question.question_type as QType;
  const correct = question.correct_answers;
  if (!isAutoGradable(t)) return null;
  // true/false: treat null/undefined answer as incorrect; support correct_answers as boolean, string, or [val]
  if (t === "true_false") {
    const ansBool = typeof answer === "boolean" ? answer : null;
    if (ansBool === null) return false;
    const corrRaw = Array.isArray(correct) && correct.length === 1 ? correct[0] : correct;
    const corrStr = normStr(corrRaw).toLowerCase();
    const corrBool = corrStr === "true" ? true : corrStr === "false" ? false : typeof corrRaw === "boolean" ? corrRaw : null;
    if (corrBool === null) return false;
    return ansBool === corrBool;
  }
  // single choice may store correct_answers as scalar or single-element array
  if (t === "single_choice") {
    const ansStr = typeof answer === "string" ? normStr(answer) : "";
    if (!ansStr) return false;
    const corrRaw = Array.isArray(correct) && correct.length === 1 ? correct[0] : correct;
    return ansStr === normStr(corrRaw);
  }
  if (t === "multiple_choice" || t === "multi_select") return arraysEqualIgnoreOrder(answer, correct);
  return null;
}
function hasAnswer(question: any, answer: unknown): boolean {
  const t = question.question_type as QType;
  if (t === "true_false") return typeof answer === "boolean";
  if (t === "single_choice") return typeof answer === "string" && normStr(answer) !== "";
  if (t === "multiple_choice" || t === "multi_select") return Array.isArray(answer) && (answer as any[]).length > 0;
  if (t === "paragraph") return typeof answer === "string" && normStr(answer) !== "";
  return false;
}
function fmtAnswer(question: any, answer: unknown): string {
  const t = question.question_type as QType;
  if (t === "true_false") return String(Boolean(answer));
  if (t === "single_choice") return normStr(answer);
  if (t === "multiple_choice" || t === "multi_select") return Array.isArray(answer) ? (answer as any[]).join(", ") : "";
  if (t === "paragraph") return typeof answer === "string" ? answer : String(answer ?? "");
  return String(answer ?? "");
}
function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "");
}
