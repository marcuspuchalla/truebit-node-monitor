/**
 * Input Validation Middleware using Zod
 * Validates request body, params, and query against schemas
 */

import { z } from 'zod';

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
    tlsEnabled: z.boolean().optional()
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

/**
 * Validation middleware factory
 * @param {Object} schema - Zod schema object with body, params, query keys
 */
export function validate(schema) {
  return async (req, res, next) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export default { validate, schemas, sanitizeString };
