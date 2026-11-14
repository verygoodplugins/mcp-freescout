import { z } from 'zod';

// Zod Schemas for runtime validation
export const AttachmentSchema = z.object({
  id: z.number(),
  file_name: z.string(),
  mime_type: z.string(),
  size: z.number(),
  url: z.string().optional(),
});

export const ThreadSchema = z.object({
  id: z.number(),
  type: z.enum(['customer', 'message', 'note']).optional(),
  state: z.string().optional(),
  body: z.string().optional(),
  created_by_customer: z.boolean().optional(),
  createdAt: z.string().optional(),
  created_at: z.string().optional(),
  to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

export const CustomerSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
});

export const ConversationSchema = z.object({
  id: z.number(),
  number: z.number(),
  subject: z.string(),
  status: z.enum(['active', 'pending', 'closed', 'spam']),
  state: z.enum(['published', 'deleted']).optional(),
  user_id: z.number().nullable().optional(),
  customer_id: z.number().optional(),
  mailbox_id: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  _embedded: z
    .object({
      threads: z.array(ThreadSchema).optional(),
      customer: CustomerSchema.optional(),
    })
    .optional(),
});

export const PageSchema = z.object({
  size: z.number(),
  totalElements: z.number(),
  totalPages: z.number(),
  number: z.number(),
});

export const ApiResponseSchema = z.object({
  _embedded: z
    .object({
      conversations: z.array(ConversationSchema).optional(),
      threads: z.array(ThreadSchema).optional(),
      customer: CustomerSchema.optional(),
    })
    .optional(),
  data: z.unknown().optional(),
  page: PageSchema.optional(),
});

export const TicketAnalysisSchema = z.object({
  ticketId: z.string(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  issueDescription: z.string(),
  hasAttachments: z.boolean(),
  attachments: z.array(z.string()),
  codeSnippets: z.array(z.string()),
  errorMessages: z.array(z.string()),
  isReproducible: z.boolean(),
  testedByTeam: z.boolean(),
  suggestedSolution: z.string().optional(),
  isBug: z.boolean(),
  isThirdPartyIssue: z.boolean(),
  rootCause: z.string().optional(),
});

// Search filter schemas
export const SearchFiltersSchema = z.object({
  // FreeScout's REST API has no body-level full-text search. `textSearch` is
  // matched against the conversation subject only (mapped to the `subject`
  // filter). Prefer the explicit `subject` field; `textSearch` is kept as an
  // alias for backward compatibility.
  textSearch: z
    .string()
    .optional()
    .describe('Alias for `subject`: matches the conversation subject only, not message bodies.'),
  subject: z.string().optional().describe('Filter by conversation subject (partial match).'),
  customerEmail: z
    .string()
    .optional()
    .describe('Filter by the customer email address on the conversation.'),
  number: z.number().optional().describe('Look up a single conversation by its ticket number.'),
  tag: z.string().trim().min(1).optional().describe('Filter by FreeScout tag name.'),
  assignee: z.union([z.literal('unassigned'), z.literal('any'), z.number()]).optional(),
  updatedSince: z.string().optional(), // ISO date or relative like "7d", "24h"
  createdSince: z.string().optional(),
  mailboxId: z.number().optional(),
  status: z.enum(['active', 'pending', 'closed', 'spam', 'all']).optional(),
  state: z.enum(['published', 'deleted']).optional(),
  page: z.number().min(1).optional(),
  pageSize: z.number().min(1).max(100).optional(),
  includeLastMessage: z.boolean().optional(), // Include the most recent message for each ticket
});

export const TagToolInputSchema = z
  .object({
    action: z
      .enum(['list', 'add', 'remove', 'replace'])
      .describe('Operation to perform; replace with an empty tags array clears all ticket tags.'),
    ticket: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Ticket ID, number, or URL. Required for add, remove, and replace; optional for list.'
      ),
    tags: z
      .array(z.string().trim().min(1))
      .optional()
      .describe(
        'Tag names for an update; required for add, remove, or replace. An empty list is allowed only for replace.'
      ),
    page: z.number().int().min(1).optional().describe('Page to list; list action only.'),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('List page size, at most 100; list action only.'),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'list') {
      if (value.tags !== undefined)
        ctx.addIssue({
          code: 'custom',
          message: 'tags are only valid for updates',
          path: ['tags'],
        });
    } else {
      if (!value.ticket)
        ctx.addIssue({
          code: 'custom',
          message: 'ticket is required for updates',
          path: ['ticket'],
        });
      if (!value.tags || (value.action !== 'replace' && value.tags.length === 0)) {
        ctx.addIssue({
          code: 'custom',
          message: 'tags are required (empty only for replace)',
          path: ['tags'],
        });
      }
      if (value.page !== undefined || value.pageSize !== undefined)
        ctx.addIssue({ code: 'custom', message: 'pagination is only valid for list' });
    }
  });

export const TagPageSchema = z
  .object({
    _embedded: z
      .object({ tags: z.array(z.object({ name: z.string().min(1) }).passthrough()) })
      .passthrough(),
    page: z
      .object({
        number: z.number().int().min(1),
        totalPages: z.number().int().min(0).max(1000),
        totalElements: z.number().int().min(0),
      })
      .passthrough(),
  })
  .passthrough();

// TypeScript types inferred from Zod schemas
export type FreeScoutAttachment = z.infer<typeof AttachmentSchema>;
export type FreeScoutThread = z.infer<typeof ThreadSchema>;
export type FreeScoutCustomer = z.infer<typeof CustomerSchema>;
export type FreeScoutConversation = z.infer<typeof ConversationSchema>;
export type FreeScoutApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type TicketAnalysis = z.infer<typeof TicketAnalysisSchema>;
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export interface FreeScoutRecipients {
  to?: string[];
  cc?: string[];
  bcc?: string[];
}

// Legacy interfaces (deprecated, use Zod schemas above)
export interface FreeScoutPage {
  size: number;
  totalElements: number;
  totalPages: number;
  number: number;
}
