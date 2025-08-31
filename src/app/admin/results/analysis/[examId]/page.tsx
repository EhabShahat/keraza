"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Minimal shape we rely on from attempt state questions
type QType = "true_false" | "single_choice" | "multiple_choice" | "multi_select" | "paragraph";

function isAutoGradable(t: QType) {
  return t === "true_false" || t === "single_choice" || t === "multiple_choice" || t === "multi_select";
}

function normStr(s: unknown) {
  return typeof s === "string" ? s.trim() : String(s ?? "");
}

function arraysEqualIgnoreOrder(a: unknown, b: unknown) {
  const aa = Array.isArray(a) ? a.slice().sort() : [] as unknown[];
  const bb = Array.isArray(b) ? b.slice().sort() : [] as unknown[];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}

function isCorrect(question: any, answer: unknown): boolean | null {
  const t = question.question_type as QType;
  const correct = question.correct_answers;
  if (!isAutoGradable(t)) return null; // paragraph or unsupported
  if (t === "true_false") return Boolean(answer) === Boolean(correct);
  if (t === "single_choice") return normStr(answer) === normStr(correct);
  if (t === "multiple_choice" || t === "multi_select") return arraysEqualIgnoreOrder(answer, correct);
  return null;
}

export default function AnalysisPage() {
  const { examId } = useParams<{ examId: string }>();

  const examsQ = useQuery({
    queryKey: ["admin", "exams", "all"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load exams failed");
      return (j.items as any[])?.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    },
  });

  const attemptsQ = useQuery({
    queryKey: ["admin", "attempts", examId],
    enabled: !!examId,
    queryFn: async () => {
      const id = examId as string;
      const res = await authFetch(`/api/admin/exams/${id}/attempts`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load attempts failed");
      return (j.items as any[]).filter((a: any) => String(a.completion_status) === "submitted");
    },
  });

  const analysisQ = useQuery({
    enabled: !!attemptsQ.data && !!examId,
    queryKey: ["admin", "analysis", examId, (attemptsQ.data || []).length],
    queryFn: async () => {
      const atts = attemptsQ.data as any[];
      const ids = atts.map((a) => a.id);
      // limit concurrency to avoid spamming the server
      const chunkSize = 10;
      const results: any[] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const part = await Promise.all(
          chunk.map(async (id) => {
            const res = await authFetch(`/api/attempts/${id}/state`);
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || `Load state failed for ${id}`);
            return j;
          })
        );
        results.push(...part);
      }

      // Aggregate per question
      type Row = { questionId: string; question_text: string; question_type: QType; autoGradable: boolean; total: number; answered: number; correct: number };
      const map = new Map<string, Row>();
      const attemptScores: number[] = [];

      for (const st of results) {
        const answers = (st.answers ?? {}) as Record<string, unknown>;
        let totalAuto = 0;
        let correctAuto = 0;
        for (const q of st.questions as any[]) {
          const id = q.id as string;
          const t = q.question_type as QType;
          if (!map.has(id)) {
            map.set(id, { questionId: id, question_text: q.question_text, question_type: t, autoGradable: isAutoGradable(t), total: 0, answered: 0, correct: 0 });
          }
          const row = map.get(id)!;
          row.total += 1;
          const ans = answers[id];
          const hasAns = Array.isArray(ans) ? ans.length > 0 : (ans !== null && ans !== undefined && String(ans) !== "");
          if (hasAns) row.answered += 1;
          const ok = isCorrect(q, ans);
          if (ok === true) row.correct += 1;
          if (row.autoGradable) {
            totalAuto += 1;
            if (ok === true) correctAuto += 1;
          }
        }
        const pct = totalAuto ? (correctAuto / totalAuto) * 100 : 0;
        attemptScores.push(Math.round(pct));
      }

      const rows = Array.from(map.values());
      rows.sort((a, b) => a.question_text.localeCompare(b.question_text));
      const summary = {
        attempts_considered: ids.length,
        questions_considered: rows.length,
        avg_correct_rate: rows.length ? Math.round((rows.reduce((s, r) => s + (r.autoGradable ? r.correct / Math.max(1, r.total) : 0), 0) / rows.filter((r) => r.autoGradable).length) * 100) : 0,
      };

      return { rows, summary, attempt_scores: attemptScores };
    },
  });

  const selectedExam = useMemo(() => examsQ.data?.find((e) => e.id === (examId as string)) ?? null, [examsQ.data, examId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Per-question Analysis</h1>
        {selectedExam && <span className="text-sm text-gray-600">{selectedExam.title}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/admin/results`} className="btn btn-sm">Back</Link>
          {analysisQ.data && (
            <button
              className="btn btn-sm"
              onClick={() => {
                const header = ["questionId","question_text","question_type","autoGradable","total","answered","correct","correct_rate"].join(",");
                const lines = analysisQ.data.rows.map((r: any) => {
                  const rate = r.total ? (r.correct / r.total) : 0;
                  const esc = (s: string) => '"' + String(s).replace(/"/g, '""') + '"';
                  return [r.questionId, esc(r.question_text), r.question_type, r.autoGradable, r.total, r.answered, r.correct, rate.toFixed(3)].join(",");
                });
                const csv = [header, ...lines].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `analysis_${examId}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
            >Export CSV</button>
          )}
          {analysisQ.data && (
            <button
              className="btn btn-sm"
              onClick={async () => {
                const XLSX = await import("xlsx");
                const rows = analysisQ.data.rows.map((r: any) => ({
                  questionId: r.questionId,
                  question: r.question_text,
                  type: r.question_type,
                  autoGradable: r.autoGradable,
                  attempts: r.total,
                  answered: r.answered,
                  correct: r.correct,
                  correct_rate: r.total ? +(r.correct / r.total).toFixed(3) : 0,
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Analysis");
                XLSX.writeFile(wb, `analysis_${examId}.xlsx`);
              }}
            >Export XLSX</button>
          )}
          {analysisQ.data && (
            <button
              className="btn btn-sm"
              onClick={async () => {
                const mod: any = await import("jspdf");
                const JsPDF = (mod.default ?? mod.jsPDF);
                const doc = new JsPDF({ unit: "pt", format: "a4" });
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const margin = 40;
                let y = margin;

                const title = "Exam Analysis";
                doc.setFontSize(16);
                doc.text(title, margin, y);
                y += 22;

                const eid = String(examId ?? "");
                const subtitle = (examsQ.data?.find((e:any)=>e.id===eid)?.title) || `Exam ${eid}`;
                doc.setFontSize(12);
                doc.text(String(subtitle), margin, y);
                y += 18;

                const sum = analysisQ.data.summary;
                const summaryLines = [
                  `Attempts: ${sum.attempts_considered}`,
                  `Questions: ${sum.questions_considered}`,
                  `Avg correct rate: ${sum.avg_correct_rate}%`,
                ];
                for (const line of summaryLines) {
                  doc.text(line, margin, y);
                  y += 16;
                }
                y += 6;

                doc.setFontSize(12);
                doc.text("Per-question summary:", margin, y);
                y += 18;

                const maxWidth = pageWidth - margin * 2;
                const rows: any[] = analysisQ.data.rows;
                for (const r of rows) {
                  // Page break if needed
                  if (y > pageHeight - margin - 40) {
                    doc.addPage();
                    y = margin;
                  }
                  const qText = doc.splitTextToSize(String(r.question_text || ""), maxWidth);
                  doc.setFont(undefined, "bold");
                  doc.text(qText as string[], margin, y);
                  doc.setFont(undefined, "normal");
                  y += (Array.isArray(qText) ? qText.length : 1) * 14 + 4;

                  const rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
                  const meta = `Type: ${r.question_type}  |  Auto-gradable: ${r.autoGradable ? "Yes" : "No"}  |  Attempts: ${r.total}  |  Answered: ${r.answered}  |  Correct: ${r.correct}  |  Correct %: ${rate}%`;
                  const metaLines = doc.splitTextToSize(meta, maxWidth);
                  doc.text(metaLines as string[], margin, y);
                  y += (Array.isArray(metaLines) ? metaLines.length : 1) * 14 + 10;
                }

                doc.save(`analysis_${String(examId ?? "")}.pdf`);
              }}
            >Export PDF</button>
          )}
        </div>
      </div>

      {attemptsQ.isLoading && <div className="p-3">Loading attempts…</div>}
      {attemptsQ.error && <div className="p-3 text-red-600">{String((attemptsQ.error as any)?.message)}</div>}

      {analysisQ.isLoading && <div className="p-3">Computing analysis…</div>}
      {analysisQ.error && <div className="p-3 text-red-600">{String((analysisQ.error as any)?.message)}</div>}

      {analysisQ.data && (
        <div className="space-y-6">
          <div className="text-sm text-gray-700">
            Attempts: {analysisQ.data.summary.attempts_considered} · Questions: {analysisQ.data.summary.questions_considered} · Avg correct rate: {analysisQ.data.summary.avg_correct_rate}%
          </div>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Per-question correct rate */}
            <div className="card">
              <div className="font-medium mb-2">Correct rate by question</div>
              <Bar
                data={{
                  labels: analysisQ.data.rows.map((r: any) => String(r.question_text).slice(0, 40) + (String(r.question_text).length > 40 ? "…" : "")),
                  datasets: [{
                    label: "% Correct",
                    data: analysisQ.data.rows.map((r: any) => (r.total ? Math.round((r.correct / r.total) * 100) : 0)),
                    backgroundColor: "rgba(59,130,246,0.6)",
                  }],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.parsed.y}%` } } },
                  scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v: number | string) => `${v}%` } } },
                }}
              />
            </div>
            {/* Score distribution */}
            <div className="card">
              <div className="font-medium mb-2">Score distribution (auto-gradable)</div>
              {(() => {
                const scores = analysisQ.data.attempt_scores as number[];
                const bins = new Array(11).fill(0); // 0-10, 10-20, ..., 100
                for (const s of scores) {
                  const idx = Math.min(10, Math.floor(s / 10));
                  bins[idx] += 1;
                }
                const labels = bins.map((_, i) => `${i * 10}–${i === 10 ? 100 : i * 10 + 10}`);
                return (
                  <Bar
                    data={{
                      labels,
                      datasets: [{ label: "Attempts", data: bins, backgroundColor: "rgba(16,185,129,0.6)" }],
                    }}
                    options={{ responsive: true, plugins: { legend: { display: false } } }}
                  />
                );
              })()}
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="text-left">
                  <th className="p-2 border">Question</th>
                  <th className="p-2 border">Type</th>
                  <th className="p-2 border">Auto-gradable</th>
                  <th className="p-2 border">Attempts</th>
                  <th className="p-2 border">Answered</th>
                  <th className="p-2 border">Correct</th>
                  <th className="p-2 border">Correct %</th>
                </tr>
              </thead>
              <tbody>
                {analysisQ.data.rows.map((r: any) => {
                  const rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
                  return (
                    <tr key={r.questionId} className="border-t align-top">
                      <td className="p-2 border text-sm max-w-xl">
                        <div className="font-medium line-clamp-2">{r.question_text}</div>
                        <div className="text-xs text-gray-500">{r.questionId}</div>
                      </td>
                      <td className="p-2 border text-sm">{r.question_type}</td>
                      <td className="p-2 border text-sm">{r.autoGradable ? "Yes" : "No"}</td>
                      <td className="p-2 border text-sm">{r.total}</td>
                      <td className="p-2 border text-sm">{r.answered}</td>
                      <td className="p-2 border text-sm">{r.correct}</td>
                      <td className="p-2 border text-sm">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
