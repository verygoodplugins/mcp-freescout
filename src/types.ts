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
  body: z.string().optional(),
  created_by_customer: z.boolean().optional(),
  created_at: z.string().optional(),
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
  _embedded: z
    .object({
      threads: z.array(ThreadSchema).optional(),
      customer: CustomerSchema.optional(),
    })
    .optional(),
});

export const PageSchema = z.object({
  size: z.number(),
  total_elements: z.number(),
  total_pages: z.number(),
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
  textSearch: z.string().optional(),
  assignee: z.union([z.literal('unassigned'), z.literal('any'), z.number()]).optional(),
  updatedSince: z.string().optional(), // ISO date or relative like "7d", "24h"
  createdSince: z.string().optional(),
  mailboxId: z.number().optional(),
  status: z.enum(['active', 'pending', 'closed', 'spam', 'all']).optional(),
  state: z.enum(['published', 'deleted']).optional(),
  page: z.number().min(1).optional(),
  pageSize: z.number().min(1).max(100).optional(),
});

// TypeScript types inferred from Zod schemas
export type FreeScoutAttachment = z.infer<typeof AttachmentSchema>;
export type FreeScoutThread = z.infer<typeof ThreadSchema>;
export type FreeScoutCustomer = z.infer<typeof CustomerSchema>;
export type FreeScoutConversation = z.infer<typeof ConversationSchema>;
export type FreeScoutApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type TicketAnalysis = z.infer<typeof TicketAnalysisSchema>;
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

// Legacy interfaces (deprecated, use Zod schemas above)
export interface FreeScoutPage {
  size: number;
  total_elements: number;
  total_pages: number;
  number: number;
}
