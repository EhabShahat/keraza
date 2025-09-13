/**
 * Example: Admin API Handler using Unified Framework
 * 
 * This example shows how to create a consolidated admin API handler
 * that replaces multiple individual route files.
 */

import { NextRequest } from "next/server";
import {
  UnifiedAPIHandler,
  adminMiddleware,
  createValidationMiddleware,
  createResponse,
  createErrorResponse,
  type APIRequest
} from "../index";

/**
 * Create the unified admin handler
 */
const adminHandler = new UnifiedAPIHandler();

// Add exam management routes
adminHandler.addRoute({
  path: 'exams',
  method: 'GET',
  handler: async (request: APIRequest) => {
    const { query } = request;
    const searchQuery = query.q;
    
    // Get Supabase client
    const supabase = adminHandler.getSupabaseClient(request);
    
    // Build query
    let dbQuery = supabase.from("exams").select("*").order("start_time", { ascending: true, nullsFirst: true });
    
    if (searchQuery) {
      dbQuery = dbQuery.ilike("title", `%${searchQuery}%`);
    }
    
    const { data, error } = await dbQuery;
    
    if (error) {
      return createErrorResponse(error.message, 400);
    }
    
    return createResponse({ items: data });
  },
  middleware: adminMiddleware,
  requireAdmin: true
});

adminHandler.addRoute({
  path: 'exams',
  method: 'POST',
  handler: async (request: APIRequest) => {
    const supabase = adminHandler.getSupabaseClient(request);
    
    const {
      title,
      description = null,
      start_time,
      end_time,
      duration_minutes,
      status = "draft",
      access_type = "open",
      settings = {},
    } = request.body || {};

    const { data, error } = await supabase
      .from("exams")
      .insert({ title, description, start_time, end_time, duration_minutes, status, access_type, settings })
      .select("*")
      .single();
      
    if (error) {
      return createErrorResponse(error.message, 400);
    }
    
    return createResponse({ item: data });
  },
  middleware: [
    ...adminMiddleware,
    createValidationMiddleware([
      { field: 'title', type: 'string', required: true, min: 1, max: 255 },
      { field: 'description', type: 'string', max: 1000 },
      { field: 'duration_minutes', type: 'number', required: true, min: 1 },
      { field: 'status', type: 'string', enum: ['draft', 'published', 'archived'] },
      { field: 'access_type', type: 'string', enum: ['open', 'code', 'ip'] }
    ])
  ],
  requireAdmin: true
});

// Add student management routes
adminHandler.addRoute({
  path: 'students',
  method: 'GET',
  handler: async (request: APIRequest) => {
    const supabase = adminHandler.getSupabaseClient(request);
    const { query } = request;
    
    let dbQuery = supabase.from("students").select("*").order("created_at", { ascending: false });
    
    if (query.search) {
      dbQuery = dbQuery.or(`name.ilike.%${query.search}%,code.ilike.%${query.search}%`);
    }
    
    const { data, error } = await dbQuery;
    
    if (error) {
      return createErrorResponse(error.message, 400);
    }
    
    return createResponse({ items: data });
  },
  middleware: adminMiddleware,
  requireAdmin: true
});

adminHandler.addRoute({
  path: 'students',
  method: 'POST',
  handler: async (request: APIRequest) => {
    const supabase = adminHandler.getSupabaseClient(request);
    const { name, code, email, phone } = request.body || {};

    const { data, error } = await supabase
      .from("students")
      .insert({ name, code, email, phone })
      .select("*")
      .single();
      
    if (error) {
      return createErrorResponse(error.message, 400);
    }
    
    return createResponse({ item: data });
  },
  middleware: [
    ...adminMiddleware,
    createValidationMiddleware([
      { field: 'name', type: 'string', required: true, min: 1, max: 255 },
      { field: 'code', type: 'string', required: true, min: 1, max: 50 },
      { field: 'email', type: 'string', max: 255 },
      { field: 'phone', type: 'string', max: 20 }
    ])
  ],
  requireAdmin: true
});

// Add settings management routes
adminHandler.addRoute({
  path: 'settings',
  method: 'GET',
  handler: async (request: APIRequest) => {
    const supabase = adminHandler.getSupabaseClient(request);
    
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
      
    if (error) {
      return createErrorResponse(error.message, 400);
    }
    
    return createResponse(data || {});
  },
  middleware: adminMiddleware,
  requireAdmin: true
});

adminHandler.addRoute({
  path: 'settings',
  method: 'PUT',
  handler: async (request: APIRequest) => {
    const supabase = adminHandler.getSupabaseClient(request);
    const settings = request.body;

    // First try to update existing settings
    const { data: existingData } = await supabase
      .from("app_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    let result;
    if (existingData) {
      // Update existing
      result = await supabase
        .from("app_settings")
        .update(settings)
        .eq("id", existingData.id)
        .select("*")
        .single();
    } else {
      // Insert new
      result = await supabase
        .from("app_settings")
        .insert(settings)
        .select("*")
        .single();
    }
    
    if (result.error) {
      return createErrorResponse(result.error.message, 400);
    }
    
    return createResponse({ item: result.data });
  },
  middleware: adminMiddleware,
  requireAdmin: true
});

/**
 * Export handlers for Next.js API routes
 */
export const GET = (req: NextRequest, context: any) => adminHandler.handle(req, context);
export const POST = (req: NextRequest, context: any) => adminHandler.handle(req, context);
export const PUT = (req: NextRequest, context: any) => adminHandler.handle(req, context);
export const DELETE = (req: NextRequest, context: any) => adminHandler.handle(req, context);

/**
 * Usage in Next.js:
 * 
 * Create a file at: src/app/api/admin/consolidated/route.ts
 * 
 * ```typescript
 * export { GET, POST, PUT, DELETE } from '@/lib/api/examples/admin-handler-example';
 * ```
 * 
 * This single route file would replace:
 * - src/app/api/admin/exams/route.ts
 * - src/app/api/admin/students/route.ts  
 * - src/app/api/admin/settings/route.ts
 * - And many more admin routes
 */