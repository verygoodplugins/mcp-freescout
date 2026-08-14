import { TicketAnalyzer } from '../ticket-analyzer.js';

const baseConversation = {
  id: 123,
  number: 456,
  subject: 'Support request',
  status: 'active' as const,
};

describe('TicketAnalyzer', () => {
  const analyzer = new TicketAnalyzer();

  it('extracts customer context, code, errors, reproducibility, and attachments', () => {
    const analysis = analyzer.analyzeConversation({
      ...baseConversation,
      _embedded: {
        customer: {
          id: 9,
          email: 'casey@example.com',
          first_name: 'Casey',
          last_name: 'Customer',
        },
        threads: [
          {
            id: 1,
            type: 'customer',
            body: '<p>Error: payment failed every time</p><pre>function checkout() {}</pre>',
            attachments: [{ id: 1, file_name: 'screenshot.png', mime_type: 'image/png', size: 42 }],
          },
          {
            id: 2,
            type: 'customer',
            body: 'This additional customer description is deliberately long enough to be included.',
          },
          { id: 3, type: 'note', body: 'Confirmed and reproduced by support.' },
        ],
      },
    });

    expect(analysis).toMatchObject({
      customerName: 'Casey Customer',
      customerEmail: 'casey@example.com',
      hasAttachments: true,
      testedByTeam: true,
      isReproducible: true,
      isBug: true,
    });
    expect(analysis.attachments).toEqual(['screenshot.png (image/png)']);
    expect(analysis.codeSnippets).toContain('function checkout() {}');
    expect(analysis.errorMessages).toContain(
      'Error: payment failed every time function checkout() {}'
    );
    expect(analysis.issueDescription).toContain('This additional customer description');
  });

  it('classifies third-party, configuration, and feature-request conversations', () => {
    const classify = (body: string) =>
      analyzer.analyzeConversation({
        ...baseConversation,
        _embedded: { threads: [{ id: 1, type: 'customer', body }] },
      });

    expect(classify('Elementor creates a theme conflict')).toMatchObject({
      isBug: false,
      isThirdPartyIssue: true,
      rootCause: 'Third-party plugin or system limitation',
    });
    expect(classify('The installation setup is not configured')).toMatchObject({
      isBug: false,
      rootCause: 'Configuration or setup issue',
    });
    expect(classify('This would be nice as a feature request')).toMatchObject({
      isBug: false,
      rootCause: 'Feature request, not a bug',
    });
  });

  it('handles missing customer messages and produces each reply style', () => {
    const analysis = analyzer.analyzeConversation({
      ...baseConversation,
      _embedded: { threads: [] },
    });

    expect(analysis).toMatchObject({
      customerName: 'Unknown',
      customerEmail: 'unknown@example.com',
      issueDescription: 'No customer messages found',
    });
    expect(analyzer.stripHtml(null)).toBe('');
    expect(analyzer.stripHtml('<p>Hello&nbsp;&amp; goodbye</p>')).toBe('Hello & goodbye');
    expect(analyzer.generateCustomerReply({ ...analysis, isBug: true }, 'fix it')).toContain(
      'fix it'
    );
    expect(
      analyzer.generateCustomerReply(
        { ...analysis, isBug: false, rootCause: 'Feature request' },
        undefined,
        false
      )
    ).toContain('Feature request');
    expect(
      analyzer.generateCustomerReply(
        { ...analysis, rootCause: 'Expected behavior' },
        'Explanation',
        true
      )
    ).toContain('Explanation');
  });
});
