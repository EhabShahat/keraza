/**
 * Distributed Session Management for Edge Functions
 * Handles session state across edge locations with minimal latency
 */

import { EdgeUser, EdgeAuthContext } from './edge-jwt';

export interface EdgeSession {
  id: string;
  userId: string;
  user: EdgeUser;
  createdAt: number;
  lastAccessed: number;
  expiresAt: number;
  metadata: Record<string, any>;
}

export interface SessionConfig {
  ttl: number; // Time to live in seconds
  slidingExpiration: boolean;
  maxSessions: number;
}

/**
 * Edge session storage using in-memory cache
 * In production, this could be backed by Redis or similar
 */
class EdgeSessionStore {
  private static sessions = new Map<string, EdgeSession>();
  private static userSessions = new Map<string, Set<string>>();
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly MAX_SESSIONS_PER_USER = 5;
  private static readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  
  private static cleanupTimer: any = null;

  /**
   * Initialize cleanup timer
   */
  static initialize(): void {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Create a new session
   */
  static create(
    user: EdgeUser, 
    config: Partial<SessionConfig> = {}
  ): EdgeSession {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    const ttl = (config.ttl || this.DEFAULT_TTL) * 1000; // Convert to milliseconds
    
    const session: EdgeSession = {
      id: sessionId,
      userId: user.id,
      user,
      createdAt: now,
      lastAccessed: now,
      expiresAt: now + ttl,
      metadata: {}
    };

    // Enforce max sessions per user
    this.enforceMaxSessions(user.id, config.maxSessions || this.MAX_SESSIONS_PER_USER);
    
    // Store session
    this.sessions.set(sessionId, session);
    
    // Track user sessions
    if (!this.userSessions.has(user.id)) {
      this.userSessions.set(user.id, new Set());
    }
    this.userSessions.get(user.id)!.add(sessionId);
    
    return session;
  }

  /**
   * Get session by ID
   */
  static get(sessionId: string): EdgeSession | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session last accessed time and extend expiration
   */
  static touch(
    sessionId: string, 
    slidingExpiration: boolean = true
  ): EdgeSession | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now > session.expiresAt) {
      this.delete(sessionId);
      return null;
    }

    // Update last accessed
    session.lastAccessed = now;
    
    // Extend expiration if sliding expiration is enabled
    if (slidingExpiration) {
      const ttl = session.expiresAt - session.createdAt;
      session.expiresAt = now + ttl;
    }

    return session;
  }

  /**
   * Delete session
   */
  static delete(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Remove from sessions
    this.sessions.delete(sessionId);
    
    // Remove from user sessions
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    return true;
  }

  /**
   * Delete all sessions for a user
   */
  static deleteUserSessions(userId: string): number {
    const userSessions = this.userSessions.get(userId);
    
    if (!userSessions) {
      return 0;
    }

    let deletedCount = 0;
    for (const sessionId of userSessions) {
      if (this.sessions.delete(sessionId)) {
        deletedCount++;
      }
    }

    this.userSessions.delete(userId);
    return deletedCount;
  }

  /**
   * Update session metadata
   */
  static updateMetadata(
    sessionId: string, 
    metadata: Record<string, any>
  ): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    session.metadata = { ...session.metadata, ...metadata };
    return true;
  }

  /**
   * Get all sessions for a user
   */
  static getUserSessions(userId: string): EdgeSession[] {
    const userSessions = this.userSessions.get(userId);
    
    if (!userSessions) {
      return [];
    }

    const sessions: EdgeSession[] = [];
    for (const sessionId of userSessions) {
      const session = this.sessions.get(sessionId);
      if (session && Date.now() <= session.expiresAt) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Enforce maximum sessions per user
   */
  private static enforceMaxSessions(userId: string, maxSessions: number): void {
    const userSessions = this.getUserSessions(userId);
    
    if (userSessions.length >= maxSessions) {
      // Sort by last accessed (oldest first)
      userSessions.sort((a, b) => a.lastAccessed - b.lastAccessed);
      
      // Delete oldest sessions
      const toDelete = userSessions.length - maxSessions + 1;
      for (let i = 0; i < toDelete; i++) {
        this.delete(userSessions[i].id);
      }
    }
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `sess_${timestamp}_${random}`;
  }

  /**
   * Cleanup expired sessions
   */
  private static cleanup(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Get session statistics
   */
  static getStats(): {
    totalSessions: number;
    totalUsers: number;
    averageSessionsPerUser: number;
  } {
    return {
      totalSessions: this.sessions.size,
      totalUsers: this.userSessions.size,
      averageSessionsPerUser: this.userSessions.size > 0 
        ? this.sessions.size / this.userSessions.size 
        : 0
    };
  }

  /**
   * Clear all sessions (for testing/maintenance)
   */
  static clear(): void {
    this.sessions.clear();
    this.userSessions.clear();
  }
}

/**
 * Session manager for edge functions
 */
export class EdgeSessionManager {
  private config: SessionConfig;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = {
      ttl: config.ttl || 3600, // 1 hour
      slidingExpiration: config.slidingExpiration ?? true,
      maxSessions: config.maxSessions || 5
    };

    // Initialize store
    EdgeSessionStore.initialize();
  }

  /**
   * Create session from authentication context
   */
  createSession(authContext: EdgeAuthContext): EdgeSession | null {
    if (!authContext.isAuthenticated || !authContext.user) {
      return null;
    }

    return EdgeSessionStore.create(authContext.user, this.config);
  }

  /**
   * Get session and update access time
   */
  getSession(sessionId: string): EdgeSession | null {
    return EdgeSessionStore.touch(sessionId, this.config.slidingExpiration);
  }

  /**
   * Validate session and return user context
   */
  validateSession(sessionId: string): EdgeAuthContext {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return {
        isAuthenticated: false,
        error: 'Invalid or expired session'
      };
    }

    return {
      isAuthenticated: true,
      user: session.user
    };
  }

  /**
   * Destroy session
   */
  destroySession(sessionId: string): boolean {
    return EdgeSessionStore.delete(sessionId);
  }

  /**
   * Destroy all user sessions
   */
  destroyUserSessions(userId: string): number {
    return EdgeSessionStore.deleteUserSessions(userId);
  }

  /**
   * Update session metadata
   */
  updateSessionMetadata(
    sessionId: string, 
    metadata: Record<string, any>
  ): boolean {
    return EdgeSessionStore.updateMetadata(sessionId, metadata);
  }

  /**
   * Get user sessions
   */
  getUserSessions(userId: string): EdgeSession[] {
    return EdgeSessionStore.getUserSessions(userId);
  }

  /**
   * Get session statistics
   */
  getStats() {
    return EdgeSessionStore.getStats();
  }
}

/**
 * Extract session ID from request
 */
export function extractSessionId(request: Request): string | null {
  // Check cookies first
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    return cookies.sessionId || cookies.session_id || null;
  }

  // Check headers
  const sessionHeader = request.headers.get('X-Session-ID');
  if (sessionHeader) {
    return sessionHeader;
  }

  return null;
}

/**
 * Create session cookie
 */
export function createSessionCookie(
  sessionId: string, 
  options: {
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    domain?: string;
    path?: string;
  } = {}
): string {
  const {
    maxAge = 3600,
    secure = true,
    httpOnly = true,
    sameSite = 'Lax',
    domain,
    path = '/'
  } = options;

  let cookie = `sessionId=${sessionId}; Max-Age=${maxAge}; Path=${path}`;
  
  if (secure) {
    cookie += '; Secure';
  }
  
  if (httpOnly) {
    cookie += '; HttpOnly';
  }
  
  if (sameSite) {
    cookie += `; SameSite=${sameSite}`;
  }
  
  if (domain) {
    cookie += `; Domain=${domain}`;
  }

  return cookie;
}

/**
 * Default session manager instance
 */
export const defaultSessionManager = new EdgeSessionManager();