import { useEffect, useRef, useState, useCallback } from 'react';
import { AttemptChange, SyncResult } from '@/lib/api/realtime-attempt';

export interface RealtimeAttemptConfig {
  attemptId: string;
  autoSaveInterval?: number;
  maxRetries?: number;
  conflictStrategy?: 'merge' | 'local' | 'server';
  enableSSE?: boolean;
}

export interface RealtimeAttemptState {
  connected: boolean;
  syncing: boolean;
  lastSync?: Date;
  pendingChanges: number;
  conflicts: Array<{
    questionId: string;
    localValue: any;
    serverValue: any;
  }>;
  error?: string;
}

/**
 * Hook for real-time attempt management with auto-save and synchronization
 */
export function useRealtimeAttempt(config: RealtimeAttemptConfig) {
  const {
    attemptId,
    autoSaveInterval = 5000,
    maxRetries = 3,
    conflictStrategy = 'merge',
    enableSSE = true
  } = config;

  const [state, setState] = useState<RealtimeAttemptState>({
    connected: false,
    syncing: false,
    pendingChanges: 0,
    conflicts: []
  });

  const pendingChangesRef = useRef<AttemptChange[]>([]);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const eventSourceRef = useRef<EventSource>();
  const connectionIdRef = useRef<string>();
  const lastVersionRef = useRef<number>(1);

  // Initialize connection
  useEffect(() => {
    if (!attemptId) return;

    connectionIdRef.current = `conn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Initialize real-time monitoring
    initializeRealtimeMonitoring();

    // Set up SSE connection if enabled
    if (enableSSE) {
      setupSSEConnection();
    }

    // Set up auto-save timer
    setupAutoSave();

    return () => {
      cleanup();
    };
  }, [attemptId, enableSSE]);

  const initializeRealtimeMonitoring = async () => {
    try {
      const response = await fetch(`/api/attempts/${attemptId}?action=realtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'init_monitoring',
          data: { connectionId: connectionIdRef.current }
        })
      });

      if (response.ok) {
        setState(prev => ({ ...prev, connected: true, error: undefined }));
      } else {
        const error = await response.json();
        setState(prev => ({ ...prev, error: error.error || 'Failed to initialize' }));
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  const setupSSEConnection = () => {
    if (!connectionIdRef.current) return;

    const eventSource = new EventSource(
      `/api/attempts/${attemptId}/sse?connectionId=${connectionIdRef.current}`
    );

    eventSource.onopen = () => {
      setState(prev => ({ ...prev, connected: true, error: undefined }));
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = () => {
      setState(prev => ({ ...prev, connected: false, error: 'Connection lost' }));
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          setupSSEConnection();
        }
      }, 5000);
    };

    eventSourceRef.current = eventSource;
  };

  const handleSSEMessage = (data: any) => {
    switch (data.type) {
      case 'connected':
        setState(prev => ({ ...prev, connected: true }));
        break;
      case 'update':
        // Handle real-time updates from server
        if (data.data?.type === 'version_update') {
          lastVersionRef.current = data.data.version;
        }
        break;
      case 'heartbeat':
        // Keep connection alive
        break;
      default:
        console.log('Unknown SSE message type:', data.type);
    }
  };

  const setupAutoSave = () => {
    autoSaveTimerRef.current = setInterval(() => {
      if (pendingChangesRef.current.length > 0) {
        performAutoSave();
      }
    }, autoSaveInterval);
  };

  const performAutoSave = async () => {
    if (pendingChangesRef.current.length === 0 || state.syncing) {
      return;
    }

    setState(prev => ({ ...prev, syncing: true }));

    try {
      const changes = [...pendingChangesRef.current];
      pendingChangesRef.current = [];

      const response = await fetch(`/api/attempts/${attemptId}?action=realtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'auto_save',
          data: {
            changes,
            config: {
              maxRetries,
              conflictStrategy,
              batchSize: 10
            }
          }
        })
      });

      const result: SyncResult = await response.json();

      if (result.success) {
        lastVersionRef.current = result.version;
        setState(prev => ({
          ...prev,
          syncing: false,
          lastSync: new Date(),
          pendingChanges: 0,
          conflicts: result.conflicts || [],
          error: undefined
        }));
      } else {
        // Re-add changes to pending if save failed
        pendingChangesRef.current.unshift(...changes);
        setState(prev => ({
          ...prev,
          syncing: false,
          error: result.error,
          pendingChanges: pendingChangesRef.current.length
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        syncing: false,
        error: error.message,
        pendingChanges: pendingChangesRef.current.length
      }));
    }
  };

  // Public methods
  const addChange = useCallback((change: AttemptChange) => {
    pendingChangesRef.current.push({
      ...change,
      timestamp: Date.now()
    });

    setState(prev => ({
      ...prev,
      pendingChanges: pendingChangesRef.current.length
    }));
  }, []);

  const saveAnswer = useCallback((questionId: string, value: any) => {
    addChange({
      questionId,
      value,
      timestamp: Date.now(),
      type: 'answer'
    });
  }, [addChange]);

  const saveAutoSaveData = useCallback((questionId: string, value: any) => {
    addChange({
      questionId,
      value,
      timestamp: Date.now(),
      type: 'auto_save'
    });
  }, [addChange]);

  const logActivity = useCallback((activityType: string, data?: any) => {
    addChange({
      questionId: 'activity',
      value: { type: activityType, data },
      timestamp: Date.now(),
      type: 'activity'
    });
  }, [addChange]);

  const forceSave = useCallback(async () => {
    if (pendingChangesRef.current.length > 0) {
      await performAutoSave();
    }
  }, []);

  const forceSync = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, syncing: true }));

      const response = await fetch(`/api/attempts/${attemptId}?action=realtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'force_sync',
          data: {}
        })
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          syncing: false,
          lastSync: new Date(),
          error: undefined
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        syncing: false,
        error: error.message
      }));
    }
  }, [attemptId]);

  const resolveConflict = useCallback(async (
    questionId: string,
    resolution: 'local' | 'server' | 'merge',
    localValue?: any,
    serverValue?: any
  ) => {
    try {
      const response = await fetch(`/api/attempts/${attemptId}?action=resolve_conflict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          resolution,
          localValue,
          serverValue
        })
      });

      if (response.ok) {
        const result = await response.json();
        lastVersionRef.current = result.version;
        
        // Remove resolved conflict
        setState(prev => ({
          ...prev,
          conflicts: prev.conflicts.filter(c => c.questionId !== questionId)
        }));

        return result.resolvedAnswer;
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  }, [attemptId]);

  const cleanup = () => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  return {
    state,
    saveAnswer,
    saveAutoSaveData,
    logActivity,
    forceSave,
    forceSync,
    resolveConflict,
    addChange
  };
}

export default useRealtimeAttempt;