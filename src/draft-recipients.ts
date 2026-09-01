import type { FreeScoutConversation, FreeScoutRecipients } from './types.js';

const recipientFields = ['to', 'cc', 'bcc'] as const;

export function shouldInheritDraftRecipients(recipients: FreeScoutRecipients): boolean {
  return recipientFields.some((field) => recipients[field] === undefined);
}

/**
 * Recipients a draft reply should inherit when the caller omits `to`/`cc`/`bcc`.
 *
 * A reply continues an existing exchange, so the most reliable default is the
 * recipient set of the latest *outbound* reply (a thread of type `message`)
 * that actually addressed someone. FreeScout keeps a single customer per
 * conversation and stores an empty `to` on the conversation itself for inbound
 * tickets, so inheriting `conversation.to` never populates `to`: FreeScout then
 * re-addresses the draft to the conversation's customer. When a ticket is
 * carried on from a different address on the same domain (e.g. a shared support
 * mailbox), that customer is not the person the team has been replying to, and
 * the real recipient is dropped from both TO and CC.
 *
 * Falling back to the last outbound reply's recipients keeps the draft on the
 * same thread the team already established. When the ticket has no outbound
 * reply yet (first response, or notes only), we fall back to the conversation
 * recipients, preserving the previous behaviour for that case.
 *
 * Threads are ordered by descending `id` (monotonic in FreeScout) rather than
 * by timestamp, so this does not depend on the array order or on a `created_at`
 * field the API returns in camelCase.
 */
export function deriveInheritedRecipients(
  conversation: FreeScoutConversation
): FreeScoutRecipients {
  const threads = conversation._embedded?.threads ?? [];

  const lastOutboundReply = threads
    .filter((thread) => thread.type === 'message' && (thread.to?.length ?? 0) > 0)
    .sort((a, b) => b.id - a.id)[0];

  if (lastOutboundReply) {
    return {
      to: lastOutboundReply.to,
      cc: lastOutboundReply.cc,
      bcc: lastOutboundReply.bcc,
    };
  }

  return {
    to: conversation.to,
    cc: conversation.cc,
    bcc: conversation.bcc,
  };
}

export function resolveDraftReplyRecipients(
  explicitRecipients: FreeScoutRecipients,
  inheritedRecipients: FreeScoutRecipients
): FreeScoutRecipients {
  const resolved: FreeScoutRecipients = {};

  for (const field of recipientFields) {
    const value =
      explicitRecipients[field] !== undefined
        ? explicitRecipients[field]
        : inheritedRecipients[field];

    if (value !== undefined) {
      resolved[field] = value;
    }
  }

  return resolved;
}
