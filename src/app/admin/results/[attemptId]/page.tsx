"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useParams } from "next/navigation";

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

  if (!attemptId) {
    return (
      <div className="space-y-4">
        <div className="p-3">Loading…</div>
      </div>
    );
  }

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
            <div><span className="text-gray-600">Status:</span> {metaQ.data.completion_status ?? "-"}</div>
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
            return (
              <tr key={q.id} className="border-t align-top">
                <td className="p-2 border text-sm max-w-xl">
                  <div className="font-medium line-clamp-2">{stripHtml(String(q.question_text ?? ""))}</div>
                  <div className="text-xs text-gray-500">{q.id}</div>
                </td>
                <td className="p-2 border text-sm">{q.question_type}</td>
                <td className="p-2 border text-sm whitespace-pre-wrap">{fmtAnswer(q, ans)}</td>
                <td className="p-2 border text-sm">
                  {ok === null ? <span className="text-gray-500">n/a</span> : ok ? <span className="text-green-700">✔</span> : <span className="text-red-700">✘</span>}
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
