import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { attemptOperations } from "@/lib/api/attempt-operations";

export const dynamic = "force-dynamic";

// Utility functions
function coerceArray(val: any): any[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [];
}

async function readBody(req: NextRequest): Promise<any> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      return await req.json();
    }
    const text = await req.text();
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  } catch {
    return {};
  }
}

// Handler for activity logging
async function handleActivity(req: NextRequest, attemptId: string) {
  try {
    const body = await readBody(req);
    const events: any[] = coerceArray(
      Array.isArray(body) ? body : body?.events ?? body?.batch
    );

    const insertedCount = await attemptOperations.logAttemptActivity(attemptId, events);
    return NextResponse.json({ inserted_count: insertedCount });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}

// Handler for attempt info
async function handleInfo(attemptId: string) {
  try {
    const info = await attemptOperations.getAttemptInfo(attemptId);
    if (!info) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    return NextResponse.json(info);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Handler for saving attempt
async function handleSave(req: NextRequest, attemptId: string) {
  try {
    const body = await req.json().catch(() => ({}));
    const { answers, auto_save_data, expected_version } = body || {};

    const result = await attemptOperations.saveAttempt(
      attemptId,
      answers ?? {},
      auto_save_data ?? {},
      expected_version ?? 1
    );

    if (result.conflict) {
      return NextResponse.json(
        { error: "version_mismatch", latest: result.latest },
        { status: 409 }
      );
    }

    return NextResponse.json({ new_version: result.new_version });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}

// Handler for optimized save with real-time features
async function handleOptimizedSave(req: NextRequest, attemptId: string) {
  try {
    const body = await req.json().catch(() => ({}));
    const { answers, autoSaveData, expectedVersion, changes } = body || {};

    // Import RealtimeAttemptManager for optimized save
    const { RealtimeAttemptManager } = await import("@/lib/api/realtime-attempt");
    const realtimeManager = new RealtimeAttemptManager();

    // Use optimized auto-save if changes are provided
    if (Array.isArray(changes) && changes.length > 0) {
      const result = await realtimeManager.optimizedAutoSave(attemptId, changes, {
        interval: 5000,
        maxRetries: 3,
        conflictStrategy: 'merge',
        batchSize: 10
      });

      return NextResponse.json({
        success: result.success,
        version: result.version,
        conflicts: result.conflicts
      });
    }

    // Fallback to regular save
    const result = await attemptOperations.saveAttempt(
      attemptId,
      answers ?? {},
      autoSaveData ?? {},
      expectedVersion ?? 1
    );

    if (result.conflict) {
      return NextResponse.json({
        success: false,
        conflict: true,
        serverVersion: result.latest?.version,
        latest: result.latest
      });
    }

    return NextResponse.json({
      success: true,
      version: result.new_version
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}

// Handler for conflict resolution
async function handleConflictResolution(req: NextRequest, attemptId: string) {
  try {
    const body = await req.json().catch(() => ({}));
    const { questionId, resolution, localValue, serverValue } = body || {};

    if (!questionId || !resolution) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }

    let finalAnswer;
    switch (resolution) {
      case 'local':
        finalAnswer = localValue;
        break;
      case 'server':
        finalAnswer = serverValue;
        break;
      case 'merge':
        // Simple merge strategy - could be enhanced based on question type
        finalAnswer = localValue !== undefined ? localValue : serverValue;
        break;
      default:
        return NextResponse.json({ error: "invalid_resolution" }, { status: 400 });
    }

    // Save the resolved answer
    const answers = { [questionId]: finalAnswer };
    const result = await attemptOperations.saveAttempt(attemptId, answers, {}, 1);

    return NextResponse.json({
      success: true,
      version: result.new_version,
      resolvedAnswer: finalAnswer
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}

// Handler for force synchronization
async function handleForceSync(req: NextRequest, attemptId: string) {
  try {
    const body = await req.json().catch(() => ({}));
    const { localVersion, pendingChanges } = body || {};

    const { RealtimeAttemptManager } = await import("@/lib/api/realtime-attempt");
    const realtimeManager = new RealtimeAttemptManager();

    if (typeof localVersion === 'number' && Array.isArray(pendingChanges)) {
      const syncResult = await realtimeManager.synchronizeAttempt(
        attemptId, 
        localVersion, 
        pendingChanges
      );
      return NextResponse.json(syncResult);
    }

    // Simple force sync without pending changes
    await realtimeManager.forceSynchronization(attemptId);
    const currentState = await attemptOperations.getAttemptState(attemptId);
    
    return NextResponse.json({
      synchronized: true,
      version: currentState?.version || 1,
      state: currentState
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}

// Handler for getting attempt state
async function handleState(attemptId: string) {
  try {
    const state = await attemptOperations.getAttemptState(attemptId);
    return NextResponse.json(state);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Handler for submitting attempt
async function handleSubmit(attemptId: string) {
  try {
    const result = await attemptOperations.submitAttempt(attemptId);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Handler for batch operations
async function handleBatch(req: NextRequest, attemptId: string) {
  try {
    const body = await readBody(req);
    const { operation, data } = body || {};

    switch (operation) {
      case 'batch_save':
        if (!Array.isArray(data)) {
          return NextResponse.json({ error: "invalid_batch_data" }, { status: 400 });
        }
        const saveResults = await attemptOperations.batchSaveAttempts(data);
        return NextResponse.json({ results: saveResults });

      case 'batch_activity':
        if (!Array.isArray(data)) {
          return NextResponse.json({ error: "invalid_batch_data" }, { status: 400 });
        }
        const activityResults = await attemptOperations.batchLogAttemptActivity(data);
        return NextResponse.json({ results: activityResults });

      case 'multiple_states':
        if (!Array.isArray(data)) {
          return NextResponse.json({ error: "invalid_attempt_ids" }, { status: 400 });
        }
        const states = await attemptOperations.getMultipleAttemptStatesOptimized(data);
        return NextResponse.json({ states });

      case 'multiple_info':
        if (!Array.isArray(data)) {
          return NextResponse.json({ error: "invalid_attempt_ids" }, { status: 400 });
        }
        const info = await attemptOperations.getMultipleAttemptInfo(data);
        return NextResponse.json({ info });

      case 'validate_multiple':
        if (!Array.isArray(data)) {
          return NextResponse.json({ error: "invalid_attempt_ids" }, { status: 400 });
        }
        const validations = await attemptOperations.validateMultipleAttempts(data);
        return NextResponse.json({ validations });

      default:
        return NextResponse.json({ error: "invalid_batch_operation" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Handler for statistics and monitoring
async function handleStats(req: NextRequest, attemptId: string) {
  try {
    const url = new URL(req.url);
    const examId = url.searchParams.get("exam_id");
    const type = url.searchParams.get("type") || "stats";

    switch (type) {
      case 'stats':
        const stats = await attemptOperations.getAttemptStats(examId || undefined);
        return NextResponse.json(stats);

      case 'active':
        const active = await attemptOperations.getActiveAttempts(examId || undefined);
        return NextResponse.json({ active_attempts: active });

      case 'optimization':
        const metrics = attemptOperations.getOptimizationMetrics();
        return NextResponse.json(metrics);

      case 'analysis':
        const analysis = await attemptOperations.analyzeQueryPerformance();
        return NextResponse.json(analysis);

      default:
        return NextResponse.json({ error: "invalid_stats_type" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Handler for optimization operations
async function handleOptimization(req: NextRequest, attemptId: string) {
  try {
    const body = await readBody(req);
    const { operation, data } = body || {};

    switch (operation) {
      case 'preload':
        if (!Array.isArray(data)) {
          return NextResponse.json({ error: "invalid_exam_ids" }, { status: 400 });
        }
        await attemptOperations.preloadAttemptData(data);
        return NextResponse.json({ success: true, preloaded_exams: data.length });

      case 'clear_cache':
        attemptOperations.clearOptimizationCache();
        return NextResponse.json({ success: true, message: "Cache cleared" });

      case 'analyze':
        const analysis = await attemptOperations.analyzeQueryPerformance();
        return NextResponse.json(analysis);

      default:
        return NextResponse.json({ error: "invalid_optimization_operation" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Handler for real-time synchronization operations
async function handleRealtime(req: NextRequest, attemptId: string) {
  try {
    const body = await readBody(req);
    const { operation, data } = body || {};

    // Import RealtimeAttemptManager dynamically to avoid circular dependencies
    const { RealtimeAttemptManager } = await import("@/lib/api/realtime-attempt");
    const realtimeManager = new RealtimeAttemptManager();

    switch (operation) {
      case 'init_monitoring':
        const connectionId = data?.connectionId || `conn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await realtimeManager.initializeRealtimeMonitoring(attemptId, connectionId);
        return NextResponse.json({ 
          success: true, 
          connectionId,
          message: "Real-time monitoring initialized" 
        });

      case 'auto_save':
        const { changes, config } = data || {};
        if (!Array.isArray(changes)) {
          return NextResponse.json({ error: "invalid_changes_array" }, { status: 400 });
        }
        
        const autoSaveResult = await realtimeManager.optimizedAutoSave(attemptId, changes, config);
        return NextResponse.json(autoSaveResult);

      case 'synchronize':
        const { localVersion, localChanges } = data || {};
        if (typeof localVersion !== 'number' || !Array.isArray(localChanges)) {
          return NextResponse.json({ error: "invalid_sync_data" }, { status: 400 });
        }
        
        const syncResult = await realtimeManager.synchronizeAttempt(attemptId, localVersion, localChanges);
        return NextResponse.json(syncResult);

      case 'sync_status':
        const syncStatus = realtimeManager.getSyncStatus(attemptId);
        return NextResponse.json({ syncStatus });

      case 'force_sync':
        await realtimeManager.forceSynchronization(attemptId);
        return NextResponse.json({ success: true, message: "Synchronization forced" });

      case 'stats':
        const realtimeStats = realtimeManager.getRealtimeStats();
        return NextResponse.json(realtimeStats);

      default:
        return NextResponse.json({ error: "invalid_realtime_operation" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Handler for file upload with optimized validation
async function handleUpload(req: NextRequest, attemptId: string) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) return NextResponse.json({ error: "no_file" }, { status: 400 });

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

    // Use optimized validation RPC
    const validation = await attemptOperations.validateAttemptUpload(attemptId);
    if (!validation.valid) {
      const status = validation.error_message === "attempt_not_found" ? 404 : 400;
      return NextResponse.json({ error: validation.error_message }, { status });
    }

    const svc = supabaseServer();
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `attempts/${attemptId}/ans-${ts}-${rand}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await svc.storage
      .from("answer-images")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadErr) return NextResponse.json({ error: uploadErr.message || "upload_failed" }, { status: 500 });

    const { data: urlData } = svc.storage.from("answer-images").getPublicUrl(path);
    const url = urlData?.publicUrl;
    if (!url) return NextResponse.json({ error: "url_error" }, { status: 500 });

    return NextResponse.json({ ok: true, url, path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Main route handlers with action-based routing
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await ctx.params;
    if (!attemptId) {
      return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "info":
        return handleInfo(attemptId);
      case "state":
        return handleState(attemptId);
      case "stats":
        return handleStats(req, attemptId);
      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await ctx.params;
    if (!attemptId) {
      return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Handle action from request body if not in URL
    if (!action) {
      const body = await req.json().catch(() => ({}));
      const bodyAction = body.action;
      
      switch (bodyAction) {
        case "optimized_save":
          return handleOptimizedSave(req, attemptId);
        case "resolve_conflict":
          return handleConflictResolution(req, attemptId);
        case "force_sync":
          return handleForceSync(req, attemptId);
        default:
          return NextResponse.json({ error: "invalid_action" }, { status: 400 });
      }
    }

    switch (action) {
      case "activity":
        return handleActivity(req, attemptId);
      case "submit":
        return handleSubmit(attemptId);
      case "upload":
        return handleUpload(req, attemptId);
      case "batch":
        return handleBatch(req, attemptId);
      case "optimize":
        return handleOptimization(req, attemptId);
      case "realtime":
        return handleRealtime(req, attemptId);
      case "optimized_save":
        return handleOptimizedSave(req, attemptId);
      case "resolve_conflict":
        return handleConflictResolution(req, attemptId);
      case "force_sync":
        return handleForceSync(req, attemptId);
      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await ctx.params;
    if (!attemptId) {
      return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "save":
        return handleSave(req, attemptId);
      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}