import {
  resolveDraftReplyRecipients,
  shouldInheritDraftRecipients,
} from '../draft-recipients.js';

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
