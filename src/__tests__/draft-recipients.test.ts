import {
  deriveInheritedRecipients,
  resolveDraftReplyRecipients,
  shouldInheritDraftRecipients,
} from '../draft-recipients.js';
import type { FreeScoutConversation } from '../types.js';

describe('draft recipient resolution', () => {
  it('inherits omitted recipient fields from the conversation', () => {
    const resolved = resolveDraftReplyRecipients(
      {},
      {
        to: ['customer@example.com'],
        cc: ['team@example.com'],
        bcc: ['audit@example.com'],
      }
    );

    expect(resolved).toEqual({
      to: ['customer@example.com'],
      cc: ['team@example.com'],
      bcc: ['audit@example.com'],
    });
  });

  it('merges partial overrides with inherited recipients', () => {
    const resolved = resolveDraftReplyRecipients(
      {
        to: ['override@example.com'],
        bcc: [],
      },
      {
        to: ['customer@example.com'],
        cc: ['team@example.com'],
        bcc: ['audit@example.com'],
      }
    );

    expect(resolved).toEqual({
      to: ['override@example.com'],
      cc: ['team@example.com'],
      bcc: [],
    });
  });

  it('lets explicit empty arrays clear inherited recipients', () => {
    const resolved = resolveDraftReplyRecipients(
      {
        to: [],
        cc: [],
        bcc: [],
      },
      {
        to: ['customer@example.com'],
        cc: ['team@example.com'],
        bcc: ['audit@example.com'],
      }
    );

    expect(resolved).toEqual({
      to: [],
      cc: [],
      bcc: [],
    });
  });

  it('does not require inheritance when all recipient fields are explicit', () => {
    expect(
      shouldInheritDraftRecipients({
        to: ['customer@example.com'],
        cc: [],
        bcc: ['audit@example.com'],
      })
    ).toBe(false);
  });

  it('requires inheritance when any recipient field is omitted', () => {
    expect(
      shouldInheritDraftRecipients({
        to: ['customer@example.com'],
        cc: ['team@example.com'],
      })
    ).toBe(true);
  });
});

describe('inherited recipient derivation', () => {
  const buildConversation = (overrides: Partial<FreeScoutConversation>): FreeScoutConversation =>
    ({
      id: 1,
      number: 1,
      subject: 'Test',
      status: 'active',
      ...overrides,
    }) as FreeScoutConversation;

  it('inherits from the latest outbound reply when the ticket is carried on from another address', () => {
    // Ticket opened by patrick@ but replied to on the shared customerservice@
    // mailbox: conversation.to is empty, so only the last outbound reply knows
    // the real recipient.
    const conversation = buildConversation({
      to: undefined,
      cc: ['patrick@customer.example', 'team@customer.example'],
      _embedded: {
        threads: [
          {
            id: 300,
            type: 'message',
            to: ['customerservice@customer.example'],
            cc: ['patrick@customer.example', 'team@customer.example'],
            bcc: [],
          },
          {
            id: 250,
            type: 'customer',
            to: ['support@agency.example'],
            cc: ['team@customer.example'],
          },
          { id: 200, type: 'message', to: ['customerservice@customer.example'] },
        ],
      },
    });

    expect(deriveInheritedRecipients(conversation)).toEqual({
      to: ['customerservice@customer.example'],
      cc: ['patrick@customer.example', 'team@customer.example'],
      bcc: [],
    });
  });

  it('picks the highest-id outbound reply regardless of array order', () => {
    const conversation = buildConversation({
      _embedded: {
        threads: [
          { id: 100, type: 'message', to: ['old@customer.example'] },
          { id: 400, type: 'message', to: ['latest@customer.example'] },
          { id: 250, type: 'note', to: [] },
        ],
      },
    });

    expect(deriveInheritedRecipients(conversation).to).toEqual(['latest@customer.example']);
  });

  it('ignores outbound replies that address no one', () => {
    const conversation = buildConversation({
      to: ['conversation@customer.example'],
      _embedded: {
        threads: [{ id: 500, type: 'message', to: [] }],
      },
    });

    expect(deriveInheritedRecipients(conversation).to).toEqual(['conversation@customer.example']);
  });

  it('falls back to conversation recipients when there is no outbound reply', () => {
    const conversation = buildConversation({
      to: ['customer@customer.example'],
      cc: ['team@customer.example'],
      bcc: [],
      _embedded: {
        threads: [{ id: 10, type: 'customer', to: ['support@agency.example'] }],
      },
    });

    expect(deriveInheritedRecipients(conversation)).toEqual({
      to: ['customer@customer.example'],
      cc: ['team@customer.example'],
      bcc: [],
    });
  });

  it('falls back to conversation recipients when there are no threads', () => {
    const conversation = buildConversation({
      to: ['customer@customer.example'],
      cc: [],
      bcc: [],
    });

    expect(deriveInheritedRecipients(conversation)).toEqual({
      to: ['customer@customer.example'],
      cc: [],
      bcc: [],
    });
  });
});
