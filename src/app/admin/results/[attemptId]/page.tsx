"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

  // Manual grading UI state
  const [savingManual, setSavingManual] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const [manualEdits, setManualEdits] = useState<Record<string, { awarded_points: string; notes: string }>>({});
  const hasManualSections = !!(stateQ.data && Array.isArray((stateQ.data as any).questions));
  const ungradedQuestions = ((): any[] => {
    const qs = Array.isArray((stateQ.data as any)?.questions) ? (stateQ.data as any).questions : [];
    return qs.filter((q: any) => q?.question_type === 'paragraph' || q?.question_type === 'photo_upload');
  })();
  const manualMap: Record<string, { awarded_points?: number; notes?: string; graded_at?: string }> = (stateQ.data as any)?.manual_grades_map || {};

  function setEdit(qid: string, patch: Partial<{ awarded_points: string; notes: string }>) {
    setManualEdits((prev: Record<string, { awarded_points: string; notes: string }>) => ({
      ...prev,
      [qid]: { awarded_points: prev[qid]?.awarded_points ?? '', notes: prev[qid]?.notes ?? '', ...patch }
    }));
  }

  async function saveManualGrades() {
    if (!attemptId) return;
    const entries = Object.entries(manualEdits) as Array<[string, { awarded_points: string; notes: string }]>;
    const payload = entries
      .map(([question_id, v]) => ({
        question_id,
        awarded_points: Number(v.awarded_points),
        notes: v.notes?.trim() ? v.notes : null,
      }))
      .filter((r) => Number.isFinite(r.awarded_points));
    if (payload.length === 0) return;
    setSavingManual(true);
    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/manual-grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades: payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Save failed');
      setManualEdits({});
      stateQ.refetch();
      metaQ.refetch();
    } catch (e) {
      console.error(e);
      alert((e as any)?.message || 'Save failed');
    } finally {
      setSavingManual(false);
    }
  }

  async function regradeThisAttempt() {
    if (!attemptId) return;
    setRegrading(true);
    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/regrade`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Regrade failed');
      stateQ.refetch();
      metaQ.refetch();
    } catch (e) {
      console.error(e);
      alert((e as any)?.message || 'Regrade failed');
    } finally {
      setRegrading(false);
    }
  }

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
            {stateQ.data && (() => {
              const questions = Array.isArray(stateQ.data?.questions) ? stateQ.data.questions : [];
              const answers = stateQ.data?.answers ?? {};
              let correctCount = 0;
              let totalGradable = 0;
              
              questions.forEach((q: any) => {
                const ans = answers[q.id];
                const correct = isCorrect(q, ans);
                if (correct !== null) {
                  totalGradable++;
                  if (correct) correctCount++;
                }
              });
              
              return totalGradable > 0 ? (
                <div><span className="text-gray-600">Score:</span> <span className="font-semibold">{correctCount} of {totalGradable} correct</span></div>
              ) : null;
            })()}
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
          
          {stateQ.data && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                Per-question responses
              </summary>
              <div className="mt-3">
                <PerQuestionTable state={stateQ.data} />
              </div>
            </details>
          )}
          {hasManualSections && ungradedQuestions.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                Manual grading (paragraph / photo)
              </summary>
              <div className="mt-3 space-y-3">
                {ungradedQuestions.map((q: any) => {
                  const maxPts = Number.isFinite(Number(q.points)) ? Number(q.points) : 1;
                  const current = manualMap[q.id] || {};
                  const edit = manualEdits[q.id] || { awarded_points: String(current.awarded_points ?? ''), notes: current.notes ?? '' };
                  const ans = (stateQ.data as any)?.answers?.[q.id];
                  return (
                    <div key={q.id} className="border rounded p-2">
                      <div className="text-sm font-medium">{stripHtml(String(q.question_text || ''))}</div>
                      <div className="text-xs text-gray-500 mt-1">Question ID: {q.id} · Max points: {maxPts}</div>
                      <div className="mt-2">
                        <div className="text-xs text-gray-600 mb-1">Student Answer:</div>
                        {(() => {
                          if (q.question_type === 'photo_upload') {
                            const url = typeof ans === 'string' ? ans : '';
                            return url ? (
                              <div className="flex items-start gap-3">
                                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
                                  <img src={url} alt="Student uploaded image" className="max-h-40 rounded border" />
                                </a>
                                <div className="text-xs break-all">
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Open full image</a>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">No image uploaded.</div>
                            );
                          }
                          if (q.question_type === 'paragraph') {
                            const text = typeof ans === 'string' ? ans : '';
                            return text ? (
                              <div className="p-2 bg-gray-50 border rounded text-sm whitespace-pre-wrap">{text}</div>
                            ) : (
                              <div className="text-xs text-gray-500">No answer submitted.</div>
                            );
                          }
                          // Fallback display for other types
                          return (
                            <div className="text-xs text-gray-500">{hasAnswer(q, ans) ? fmtAnswer(q, ans) : 'No answer submitted.'}</div>
                          );
                        })()}
                      </div>
                      <div className="mt-2 flex flex-col md:flex-row gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Awarded</label>
                          <input
                            type="number"
                            min={0}
                            max={maxPts}
                            step={0.5}
                            value={edit.awarded_points}
                            onChange={(e) => setEdit(q.id, { awarded_points: e.target.value })}
                            className="px-2 py-1 border rounded w-28"
                          />
                          <span className="text-sm text-gray-600">/ {maxPts}</span>
                        </div>
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={edit.notes}
                          onChange={(e) => setEdit(q.id, { notes: e.target.value })}
                          className="flex-1 px-2 py-1 border rounded"
                        />
                      </div>
                      {current.graded_at && (
                        <div className="text-xs text-gray-500 mt-1">Last graded: {new Date(current.graded_at).toLocaleString()}</div>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveManualGrades}
                    disabled={savingManual}
                    className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                  >
                    {savingManual ? 'Saving…' : 'Save Manual Grades'}
                  </button>
                  <button
                    onClick={regradeThisAttempt}
                    disabled={regrading}
                    className="px-3 py-2 rounded border"
                  >
                    {regrading ? 'Regrading…' : 'Regrade This Attempt'}
                  </button>
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {metaQ.data && (() => {
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

        const hasDeviceInfo = Object.keys(di).length > 0;

        return (
          <details className="bg-white border rounded">
            <summary className="p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold">Device Info</h2>
              <span className="text-xs text-gray-500">
                {hasDeviceInfo ? 'Click to expand' : 'No device info recorded'}
              </span>
            </summary>
            <div className="px-3 pb-3 border-t">
              {hasDeviceInfo ? (
                <>
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
                </>
              ) : (
                <p className="text-gray-500 text-sm">No device information was recorded for this attempt.</p>
              )}
            </div>
          </details>
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
          <details className="bg-white border rounded">
            <summary className="p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold">Activity Timeline</h2>
              <span className="text-xs text-gray-500">
                {items.length} events recorded
              </span>
            </summary>
            <div className="px-3 pb-3 border-t">
            {(() => {
              const counts = items.reduce((acc: Record<string, number>, ev: any) => {
                const k = String(ev?.event_type || "unknown");
                acc[k] = (acc[k] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const keys = Object.keys(counts).sort();
              
              // Separate security events from regular events
              const securityEvents = ['tab_switch', 'tab_focus', 'security_violation', 'devices_detected', 'screenshot_attempt'];
              const securityKeys = keys.filter(k => securityEvents.includes(k));
              const regularKeys = keys.filter(k => !securityEvents.includes(k));
              
              return keys.length > 0 ? (
                <div className="text-xs mb-2 space-y-2">
                  {securityKeys.length > 0 && (
                    <div>
                      <div className="text-red-700 font-semibold mb-1">🚨 Security Events:</div>
                      <div className="flex flex-wrap gap-2">
                        {securityKeys.map((k) => (
                          <span key={k} className="border border-red-300 bg-red-50 text-red-700 rounded px-2 py-1">
                            {k}: {counts[k]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {regularKeys.length > 0 && (
                    <div>
                      <div className="text-gray-700 font-semibold mb-1">📊 Regular Events:</div>
                      <div className="flex flex-wrap gap-2">
                        {regularKeys.map((k) => (
                          <span key={k} className="border rounded px-2 py-1">
                            {k}: {counts[k]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
                      const eventType = ev?.event_type || "-";
                      const isSecurityEvent = ['tab_switch', 'tab_focus', 'security_violation', 'devices_detected', 'screenshot_attempt'].includes(eventType);
                      
                      return (
                        <tr key={idx} className={`border-t align-top ${isSecurityEvent ? 'bg-red-50' : ''}`}>
                          <td className="p-2 border text-xs whitespace-nowrap">{when}</td>
                          <td className={`p-2 border text-sm ${isSecurityEvent ? 'text-red-700 font-semibold' : ''}`}>
                            {isSecurityEvent && '🚨 '}
                            {eventType}
                          </td>
                          <td className="p-2 border text-xs">
                            {(() => {
                              const payload = ev?.payload ?? {};
                              
                              // Enhanced display for security events
                              if (eventType === 'tab_switch' && payload.action === 'tab_hidden') {
                                return (
                                  <div className="text-red-700">
                                    <div className="font-semibold">Student switched away from exam tab</div>
                                    <div className="text-xs mt-1">URL: {payload.url}</div>
                                    <div className="text-xs">Time: {new Date(payload.timestamp).toLocaleString()}</div>
                                  </div>
                                );
                              }
                              
                              if (eventType === 'tab_focus' && payload.action === 'tab_visible') {
                                return (
                                  <div className="text-green-700">
                                    <div className="font-semibold">Student returned to exam tab</div>
                                    <div className="text-xs mt-1">URL: {payload.url}</div>
                                    <div className="text-xs">Time: {new Date(payload.timestamp).toLocaleString()}</div>
                                  </div>
                                );
                              }
                              
                              if (eventType === 'devices_detected') {
                                return (
                                  <div className="text-orange-700">
                                    <div className="font-semibold">{payload.count} devices detected</div>
                                    <div className="text-xs mt-1">
                                      {payload.devices?.map((device: any, i: number) => (
                                        <div key={i} className="mb-1">
                                          <span className="font-medium">{device.type}:</span> {device.name || device.productName || 'Unknown'}
                                          {device.connected !== undefined && ` (${device.connected ? 'Connected' : 'Disconnected'})`}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              
                              if (eventType === 'security_violation') {
                                return (
                                  <div className="text-red-700">
                                    <div className="font-semibold">Security violation: {payload.type}</div>
                                    <div className="text-xs mt-1">Time: {new Date(payload.timestamp).toLocaleString()}</div>
                                  </div>
                                );
                              }
                              
                              // Default JSON display for other events
                              return <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </details>
        );
      })()}

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
                <td className="p-2 border text-sm whitespace-pre-wrap">
                  {(() => {
                    if (!hasAns) return "";
                    if (q.question_type === 'photo_upload' && typeof ans === 'string') {
                      const url = ans as string;
                      return (
                        <div className="flex items-start gap-3">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
                            <img src={url} alt="Answer image" className="max-h-24 rounded border" />
                          </a>
                          <div className="text-xs break-all">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Open</a>
                          </div>
                        </div>
                      );
                    }
                    return fmtAnswer(q, ans);
                  })()}
                </td>
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

type QType = "true_false" | "single_choice" | "multiple_choice" | "multi_select" | "paragraph" | "photo_upload";
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
  const arrA = toStringArray(a).slice().sort();
  const arrB = toStringArray(b).slice().sort();
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) if (arrA[i] !== arrB[i]) return false;
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
  if (t === "photo_upload") return typeof answer === "string" && normStr(answer) !== "";
  return false;
}
function fmtAnswer(question: any, answer: unknown): string {
  const t = question.question_type as QType;
  if (t === "true_false") return String(Boolean(answer));
  if (t === "single_choice") return normStr(answer);
  if (t === "multiple_choice" || t === "multi_select") return Array.isArray(answer) ? (answer as any[]).join(", ") : "";
  if (t === "paragraph") return typeof answer === "string" ? answer : String(answer ?? "");
  if (t === "photo_upload") return typeof answer === "string" ? answer : String(answer ?? "");
  return String(answer ?? "");
}
function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "");
}
