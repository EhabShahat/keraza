import { supabaseServer } from "@/lib/supabase/server";
import { attemptOperations, AttemptState } from "./attempt-operations";

export interface RealtimeConfig {
  interval?: number;
  maxRetries?: number;
  conflictStrategy?: 'merge' | 'local' | 'server';
  batchSize?: number;
}

export interface AttemptChange {
  questionId: string;
  value: any;
  timestamp: number;
  type: 'answer' | 'auto_save' | 'navigation' | 'activity';
}

export interface SyncResult {
  success: boolean;
  version: number;
  conflicts?: Array<{
    questionId: string;
    localValue: any;
    serverValue: any;
    resolution?: 'local' | 'server' | 'merge';
  }>;
  appliedChanges?: number;
  error?: string;
}

export interface RealtimeStats {
  activeConnections: number;
  totalSyncOperations: number;
  conflictResolutions: number;
  autoSaveOperations: number;
  averageLatency: number;
  lastSyncTime?: Date;
}

/**
 * Real-time attempt management with WebSocket-like functionality,
 * auto-save optimization, and conflict resolution
 */
export class RealtimeAttemptManager {
  private connections = new Map<string, {
    attemptId: string;
    connectionId: string;
    lastActivity: Date;
    pendingChanges: AttemptChange[];
    syncInProgress: boolean;
  }>();

  private syncStats = {
    totalOperations: 0,
    conflictResolutions: 0,
    autoSaveOperations: 0,
    latencySum: 0,
    lastSyncTime: undefined as Date | undefined
  };

  private supabase = supabaseServer();

  /**
   * Initialize real-time monitoring for an attempt
   */
  async initializeRealtimeMonitoring(attemptId: string, connectionId: string): Promise<void> {
    // Store connection info
    this.connections.set(connectionId, {
      attemptId,
      connectionId,
      lastActivity: new Date(),
      pendingChanges: [],
      syncInProgress: false
    });

    // Log initialization activity
    await this.logRealtimeActivity(attemptId, {
      type: 'realtime_init',
      connectionId,
      timestamp: Date.now()
    });

    // Set up cleanup after 1 hour of inactivity
    setTimeout(() => {
      this.cleanupConnection(connectionId);
    }, 60 * 60 * 1000);
  }

  /**
   * Optimized auto-save with batching and conflict resolution
   */
  async optimizedAutoSave(
    attemptId: string, 
    changes: AttemptChange[], 
    config: RealtimeConfig = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const {
      maxRetries = 3,
      conflictStrategy = 'merge',
      batchSize = 10
    } = config;

    try {
      // Validate changes
      if (!Array.isArray(changes) || changes.length === 0) {
        return { success: false, version: 0, error: 'No changes to save' };
      }

      // Get current attempt state for version checking
      const currentState = await attemptOperations.getAttemptState(attemptId);
      if (!currentState) {
        return { success: false, version: 0, error: 'Attempt not found' };
      }

      // Process changes in batches
      const batches = this.batchChanges(changes, batchSize);
      let finalVersion = currentState.version;
      let totalConflicts: SyncResult['conflicts'] = [];
      let appliedChanges = 0;

      for (const batch of batches) {
        const batchResult = await this.processBatchWithRetry(
          attemptId, 
          batch, 
          finalVersion, 
          conflictStrategy, 
          maxRetries
        );

        if (!batchResult.success) {
          return batchResult;
        }

        finalVersion = batchResult.version;
        appliedChanges += batchResult.appliedChanges || 0;
        if (batchResult.conflicts) {
          totalConflicts.push(...batchResult.conflicts);
        }
      }

      // Update stats
      this.syncStats.autoSaveOperations++;
      this.syncStats.totalOperations++;
      this.syncStats.latencySum += (Date.now() - startTime);
      this.syncStats.lastSyncTime = new Date();

      // Log successful auto-save
      await this.logRealtimeActivity(attemptId, {
        type: 'auto_save_success',
        changesCount: changes.length,
        appliedChanges,
        conflicts: totalConflicts.length,
        latency: Date.now() - startTime,
        timestamp: Date.now()
      });

      return {
        success: true,
        version: finalVersion,
        conflicts: totalConflicts.length > 0 ? totalConflicts : undefined,
        appliedChanges
      };

    } catch (error: any) {
      // Log error
      await this.logRealtimeActivity(attemptId, {
        type: 'auto_save_error',
        error: error.message,
        changesCount: changes.length,
        timestamp: Date.now()
      });

      return {
        success: false,
        version: 0,
        error: error.message || 'Auto-save failed'
      };
    }
  }

  /**
   * Synchronize attempt with conflict resolution
   */
  async synchronizeAttempt(
    attemptId: string, 
    localVersion: number, 
    localChanges: AttemptChange[]
  ): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Get current server state
      const serverState = await attemptOperations.getAttemptState(attemptId);
      if (!serverState) {
        return { success: false, version: 0, error: 'Attempt not found' };
      }

      // Check if synchronization is needed
      if (serverState.version === localVersion && localChanges.length === 0) {
        return { 
          success: true, 
          version: serverState.version,
          appliedChanges: 0
        };
      }

      // Detect conflicts
      const conflicts = await this.detectConflicts(
        attemptId, 
        localVersion, 
        localChanges, 
        serverState
      );

      // Apply changes with conflict resolution
      const syncResult = await this.applyChangesWithConflictResolution(
        attemptId,
        localChanges,
        conflicts,
        serverState.version
      );

      // Update stats
      this.syncStats.totalOperations++;
      this.syncStats.conflictResolutions += conflicts.length;
      this.syncStats.latencySum += (Date.now() - startTime);
      this.syncStats.lastSyncTime = new Date();

      // Log synchronization
      await this.logRealtimeActivity(attemptId, {
        type: 'sync_complete',
        localVersion,
        serverVersion: syncResult.version,
        conflicts: conflicts.length,
        appliedChanges: syncResult.appliedChanges,
        latency: Date.now() - startTime,
        timestamp: Date.now()
      });

      return syncResult;

    } catch (error: any) {
      await this.logRealtimeActivity(attemptId, {
        type: 'sync_error',
        error: error.message,
        localVersion,
        timestamp: Date.now()
      });

      return {
        success: false,
        version: localVersion,
        error: error.message || 'Synchronization failed'
      };
    }
  }

  /**
   * Force synchronization (emergency sync)
   */
  async forceSynchronization(attemptId: string): Promise<void> {
    try {
      // Clear any pending operations for this attempt
      for (const [connectionId, connection] of this.connections.entries()) {
        if (connection.attemptId === attemptId) {
          connection.pendingChanges = [];
          connection.syncInProgress = false;
        }
      }

      // Log force sync
      await this.logRealtimeActivity(attemptId, {
        type: 'force_sync',
        timestamp: Date.now()
      });

      // Refresh attempt state to ensure consistency
      await attemptOperations.getAttemptState(attemptId);

    } catch (error: any) {
      console.error('Force synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Get synchronization status for an attempt
   */
  getSyncStatus(attemptId: string): {
    connected: boolean;
    pendingChanges: number;
    syncInProgress: boolean;
    lastActivity?: Date;
  } {
    for (const connection of this.connections.values()) {
      if (connection.attemptId === attemptId) {
        return {
          connected: true,
          pendingChanges: connection.pendingChanges.length,
          syncInProgress: connection.syncInProgress,
          lastActivity: connection.lastActivity
        };
      }
    }

    return {
      connected: false,
      pendingChanges: 0,
      syncInProgress: false
    };
  }

  /**
   * Get real-time statistics
   */
  getRealtimeStats(): RealtimeStats {
    const avgLatency = this.syncStats.totalOperations > 0 
      ? this.syncStats.latencySum / this.syncStats.totalOperations 
      : 0;

    return {
      activeConnections: this.connections.size,
      totalSyncOperations: this.syncStats.totalOperations,
      conflictResolutions: this.syncStats.conflictResolutions,
      autoSaveOperations: this.syncStats.autoSaveOperations,
      averageLatency: Math.round(avgLatency),
      lastSyncTime: this.syncStats.lastSyncTime
    };
  }

  /**
   * Server-Sent Events endpoint for real-time updates
   */
  async createSSEStream(attemptId: string, connectionId: string): Promise<ReadableStream> {
    // Initialize connection
    await this.initializeRealtimeMonitoring(attemptId, connectionId);

    return new ReadableStream({
      start: (controller) => {
        // Send initial connection event
        const initialEvent = `data: ${JSON.stringify({
          type: 'connected',
          attemptId,
          connectionId,
          timestamp: Date.now()
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(initialEvent));

        // Set up periodic heartbeat
        const heartbeat = setInterval(() => {
          const heartbeatEvent = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(heartbeatEvent));
        }, 30000); // 30 second heartbeat

        // Clean up on close
        const cleanup = () => {
          clearInterval(heartbeat);
          this.cleanupConnection(connectionId);
        };

        // Store cleanup function for later use
        const connection = this.connections.get(connectionId);
        if (connection) {
          (connection as any).cleanup = cleanup;
        }
      },

      cancel: () => {
        this.cleanupConnection(connectionId);
      }
    });
  }

  /**
   * Broadcast real-time update to connected clients
   */
  async broadcastUpdate(attemptId: string, update: any): Promise<void> {
    const event = `data: ${JSON.stringify({
      type: 'update',
      attemptId,
      data: update,
      timestamp: Date.now()
    })}\n\n`;

    // In a real implementation, this would send to WebSocket connections
    // For now, we log the broadcast event
    await this.logRealtimeActivity(attemptId, {
      type: 'broadcast_update',
      updateType: update.type || 'unknown',
      timestamp: Date.now()
    });
  }

  // Private helper methods

  private batchChanges(changes: AttemptChange[], batchSize: number): AttemptChange[][] {
    const batches: AttemptChange[][] = [];
    for (let i = 0; i < changes.length; i += batchSize) {
      batches.push(changes.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatchWithRetry(
    attemptId: string,
    changes: AttemptChange[],
    expectedVersion: number,
    conflictStrategy: string,
    maxRetries: number
  ): Promise<SyncResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Convert changes to answers format
        const answers: Record<string, any> = {};
        const autoSaveData: Record<string, any> = {};

        for (const change of changes) {
          if (change.type === 'answer') {
            answers[change.questionId] = change.value;
          } else if (change.type === 'auto_save') {
            autoSaveData[change.questionId] = change.value;
          }
        }

        // Attempt to save
        const result = await attemptOperations.saveAttempt(
          attemptId,
          answers,
          autoSaveData,
          expectedVersion
        );

        if (result.conflict && result.latest) {
          // Handle conflict based on strategy
          const resolvedAnswers = await this.resolveConflicts(
            answers,
            result.latest.answers,
            conflictStrategy
          );

          // Retry with resolved answers
          const retryResult = await attemptOperations.saveAttempt(
            attemptId,
            resolvedAnswers,
            autoSaveData,
            result.latest.version
          );

          return {
            success: true,
            version: retryResult.new_version,
            appliedChanges: changes.length,
            conflicts: Object.keys(answers).map(questionId => ({
              questionId,
              localValue: answers[questionId],
              serverValue: result.latest!.answers[questionId],
              resolution: conflictStrategy as any
            }))
          };
        }

        return {
          success: true,
          version: result.new_version,
          appliedChanges: changes.length
        };

      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private async detectConflicts(
    attemptId: string,
    localVersion: number,
    localChanges: AttemptChange[],
    serverState: AttemptState
  ): Promise<Array<{
    questionId: string;
    localValue: any;
    serverValue: any;
  }>> {
    const conflicts: Array<{
      questionId: string;
      localValue: any;
      serverValue: any;
    }> = [];

    // Only check for conflicts if versions differ
    if (localVersion !== serverState.version) {
      for (const change of localChanges) {
        if (change.type === 'answer') {
          const serverValue = serverState.answers[change.questionId];
          if (serverValue !== undefined && serverValue !== change.value) {
            conflicts.push({
              questionId: change.questionId,
              localValue: change.value,
              serverValue
            });
          }
        }
      }
    }

    return conflicts;
  }

  private async applyChangesWithConflictResolution(
    attemptId: string,
    changes: AttemptChange[],
    conflicts: Array<{ questionId: string; localValue: any; serverValue: any }>,
    serverVersion: number
  ): Promise<SyncResult> {
    // Prepare answers with conflict resolution
    const answers: Record<string, any> = {};
    const autoSaveData: Record<string, any> = {};
    const resolvedConflicts: SyncResult['conflicts'] = [];

    for (const change of changes) {
      const conflict = conflicts.find(c => c.questionId === change.questionId);
      
      if (conflict) {
        // Apply merge strategy for conflicts
        answers[change.questionId] = change.value; // Use local value for merge
        resolvedConflicts.push({
          questionId: change.questionId,
          localValue: change.value,
          serverValue: conflict.serverValue,
          resolution: 'merge'
        });
      } else {
        // No conflict, apply change directly
        if (change.type === 'answer') {
          answers[change.questionId] = change.value;
        } else if (change.type === 'auto_save') {
          autoSaveData[change.questionId] = change.value;
        }
      }
    }

    // Save with resolved conflicts
    const result = await attemptOperations.saveAttempt(
      attemptId,
      answers,
      autoSaveData,
      serverVersion
    );

    return {
      success: true,
      version: result.new_version,
      conflicts: resolvedConflicts.length > 0 ? resolvedConflicts : undefined,
      appliedChanges: changes.length
    };
  }

  private async resolveConflicts(
    localAnswers: Record<string, any>,
    serverAnswers: Record<string, any>,
    strategy: string
  ): Promise<Record<string, any>> {
    const resolved: Record<string, any> = { ...serverAnswers };

    for (const [questionId, localValue] of Object.entries(localAnswers)) {
      const serverValue = serverAnswers[questionId];

      switch (strategy) {
        case 'local':
          resolved[questionId] = localValue;
          break;
        case 'server':
          resolved[questionId] = serverValue;
          break;
        case 'merge':
        default:
          // Simple merge: prefer local if it exists, otherwise server
          resolved[questionId] = localValue !== undefined ? localValue : serverValue;
          break;
      }
    }

    return resolved;
  }

  private async logRealtimeActivity(attemptId: string, activity: any): Promise<void> {
    try {
      await attemptOperations.logAttemptActivity(attemptId, [{
        event_type: 'realtime_activity',
        event_time: new Date().toISOString(),
        payload: activity
      }]);
    } catch (error) {
      console.error('Failed to log realtime activity:', error);
    }
  }

  private cleanupConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Call cleanup function if it exists
      if ((connection as any).cleanup) {
        (connection as any).cleanup();
      }
      this.connections.delete(connectionId);
    }
  }
}

// Export singleton instance
export const realtimeAttemptManager = new RealtimeAttemptManager();