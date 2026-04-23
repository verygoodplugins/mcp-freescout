import type { FreeScoutRecipients } from './types.js';

const recipientFields = ['to', 'cc', 'bcc'] as const;

export function shouldInheritDraftRecipients(recipients: FreeScoutRecipients): boolean {
  return recipientFields.some((field) => recipients[field] === undefined);
}

export function resolveDraftReplyRecipients(
  explicitRecipients: FreeScoutRecipients,
  inheritedRecipients: FreeScoutRecipients
): FreeScoutRecipients {
  const resolved: FreeScoutRecipients = {};

  for (const field of recipientFields) {
    const value =
      explicitRecipients[field] !== undefined ? explicitRecipients[field] : inheritedRecipients[field];

    if (value !== undefined) {
      resolved[field] = value;
    }
  }

  return resolved;
}
