/**
 * Input Validation Middleware using Zod
 * Validates request body, params, and query against schemas
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Common schemas
export const schemas = {
  // Pagination
  pagination: z.object({
    limit: z.coerce.number().min(1).max(1000).default(100),
    offset: z.coerce.number().min(0).default(0)
  }),

  // Federation settings
  federationSettings: z.object({
    enabled: z.boolean().optional(),
    privacyLevel: z.enum(['minimal', 'balanced', 'maximum']).optional(),
    shareTasks: z.boolean().optional(),
    shareStats: z.boolean().optional(),
    natsServers: z.array(z.string().url()).optional(),
    tlsEnabled: z.boolean().optional(),
    locationEnabled: z.boolean().optional(),
    locationLabel: z.string().max(80).nullable().optional(),
    locationLat: z.coerce.number().min(-90).max(90).nullable().optional(),
    locationLon: z.coerce.number().min(-180).max(180).nullable().optional()
  }),

  // Node ID param (hex string)
  nodeIdParam: z.object({
    nodeId: z.string().regex(/^[a-fA-F0-9]+$/, 'Invalid node ID format')
  }),

  // Task ID param
  taskIdParam: z.object({
    id: z.string().min(1)
  }),

  // Log query
  logQuery: z.object({
    limit: z.coerce.number().min(1).max(1000).default(100),
    offset: z.coerce.number().min(0).default(0),
    level: z.enum(['info', 'warn', 'error', 'debug']).optional(),
    type: z.string().optional(),
    search: z.string().max(500).optional()
  }),

  // Federation messages query
  messagesQuery: z.object({
    limit: z.coerce.number().min(1).max(1000).default(100),
    offset: z.coerce.number().min(0).default(0),
    type: z.string().optional()
  }),

  // Stats query
  statsQuery: z.object({
    type: z.string().optional(),
    hours: z.coerce.number().min(1).max(720).default(24)
  })
};

interface ValidationSchema {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
}

/**
 * Validation middleware factory
 * @param schema - Zod schema object with body, params, query keys
 */
export function validate(schema: ValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params) as typeof req.params;
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query) as typeof req.query;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map((e: z.ZodIssue) => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(str: unknown): unknown {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export default { validate, schemas, sanitizeString };
