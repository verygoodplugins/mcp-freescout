import type { FreeScoutConversation, FreeScoutThread, TicketAnalysis } from './types.js';

export class TicketAnalyzer {
  analyzeConversation(conversation: FreeScoutConversation): TicketAnalysis {
    const threads = conversation._embedded?.threads || [];
    const customer = conversation._embedded?.customer;

    const customerMessages = threads.filter((t) => t.type === 'customer');
    const teamNotes = threads.filter((t) => t.type === 'note');

    // Extract issue description from customer messages
    const issueDescription = this.extractIssueDescription(customerMessages);

    // Extract code snippets and error messages
    const codeSnippets = this.extractCodeSnippets(threads);
    const errorMessages = this.extractErrorMessages(threads);

    // Check if tested by team
    const testedByTeam = this.checkTestedByTeam(teamNotes);

    // Extract attachments
    const attachments = this.extractAttachments(threads);

    // Analyze if it's a bug or third-party issue
    const analysis = this.analyzeIssueType(issueDescription, threads);

    return {
      ticketId: conversation.id.toString(),
      customerName: customer
        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
        : 'Unknown',
      customerEmail: customer?.email || 'unknown@example.com',
      issueDescription,
      hasAttachments: attachments.length > 0,
      attachments,
      codeSnippets,
      errorMessages,
      isReproducible: testedByTeam || this.checkReproducible(threads),
      testedByTeam,
      isBug: analysis.isBug,
      isThirdPartyIssue: analysis.isThirdParty,
      rootCause: analysis.rootCause,
      suggestedSolution: analysis.suggestedSolution,
    };
  }

  private extractIssueDescription(customerMessages: FreeScoutThread[]): string {
    if (customerMessages.length === 0) {
      return 'No customer messages found';
    }

    // Get the first customer message as the primary description
    const firstMessage = customerMessages[0];
    const description = this.stripHtml(firstMessage.body);

    // Add any additional context from follow-up messages
    const additionalContext = customerMessages
      .slice(1)
      .map((m) => this.stripHtml(m.body))
      .filter((text) => text.length > 50) // Only include substantial messages
      .join('\n\nAdditional context:\n');

    return additionalContext ? `${description}\n\n${additionalContext}` : description;
  }

  private extractCodeSnippets(threads: FreeScoutThread[]): string[] {
    const snippets: string[] = [];

    for (const thread of threads) {
      const body = thread.body || '';

      // Look for code blocks
      const codeBlockMatches = body.matchAll(/<pre[^>]*>.*?<\/pre>/gs);
      for (const match of codeBlockMatches) {
        snippets.push(this.stripHtml(match[0]));
      }

      // Look for inline code
      const inlineCodeMatches = body.matchAll(/<code[^>]*>.*?<\/code>/gs);
      for (const match of inlineCodeMatches) {
        const code = this.stripHtml(match[0]);
        if (code.length > 20) {
          // Only include substantial code snippets
          snippets.push(code);
        }
      }

      // Look for common code patterns in plain text
      const lines = this.stripHtml(thread.body).split('\n');
      for (const line of lines) {
        if (this.looksLikeCode(line)) {
          snippets.push(line.trim());
        }
      }
    }

    return [...new Set(snippets)]; // Remove duplicates
  }

  private extractErrorMessages(threads: FreeScoutThread[]): string[] {
    const errors: string[] = [];
    const errorPatterns = [
      /error[:\s]+(.+)/gi,
      /exception[:\s]+(.+)/gi,
      /warning[:\s]+(.+)/gi,
      /fatal[:\s]+(.+)/gi,
      /failed[:\s]+(.+)/gi,
      /cannot\s+(.+)/gi,
      /unable\s+to\s+(.+)/gi,
      /undefined\s+(.+)/gi,
      /null\s+(.+)/gi,
    ];

    for (const thread of threads) {
      const text = this.stripHtml(thread.body);

      for (const pattern of errorPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const error = match[0].trim();
          if (error.length > 10 && error.length < 500) {
            errors.push(error);
          }
        }
      }
    }

    return [...new Set(errors)];
  }

  private checkTestedByTeam(teamNotes: FreeScoutThread[]): boolean {
    const testKeywords = [
      'tested',
      'reproduced',
      'confirmed',
      'verified',
      'replicated',
      'able to reproduce',
      'can reproduce',
      'seeing the same',
    ];

    for (const note of teamNotes) {
      const text = this.stripHtml(note.body).toLowerCase();
      if (testKeywords.some((keyword) => text.includes(keyword))) {
        return true;
      }
    }

    return false;
  }

  private checkReproducible(threads: FreeScoutThread[]): boolean {
    const reproducibleKeywords = [
      'steps to reproduce',
      'how to reproduce',
      'reproduction steps',
      'always happens',
      'consistently',
      'every time',
    ];

    for (const thread of threads) {
      const text = this.stripHtml(thread.body).toLowerCase();
      if (reproducibleKeywords.some((keyword) => text.includes(keyword))) {
        return true;
      }
    }

    return false;
  }

  private extractAttachments(threads: FreeScoutThread[]): string[] {
    const attachments: string[] = [];

    for (const thread of threads) {
      if (thread.attachments && thread.attachments.length > 0) {
        for (const attachment of thread.attachments) {
          attachments.push(`${attachment.file_name} (${attachment.mime_type})`);
        }
      }
    }

    return attachments;
  }

  private analyzeIssueType(
    description: string,
    threads: FreeScoutThread[]
  ): {
    isBug: boolean;
    isThirdParty: boolean;
    rootCause?: string;
    suggestedSolution?: string;
  } {
    const fullText = threads
      .map((t) => this.stripHtml(t.body))
      .join('\n')
      .toLowerCase();

    // Check for third-party issues
    const thirdPartyIndicators = [
      'elementor',
      'third-party plugin',
      'another plugin',
      'theme conflict',
      'hosting limitation',
      'server configuration',
      'php version',
      'wordpress core',
    ];

    const isThirdParty = thirdPartyIndicators.some((indicator) => fullText.includes(indicator));

    // Check if it's a feature request vs bug
    const featureKeywords = [
      'would be nice',
      'feature request',
      'enhancement',
      'could you add',
      'is it possible to',
      'would like to',
    ];

    const isFeatureRequest = featureKeywords.some((keyword) => fullText.includes(keyword));

    // Check for configuration issues
    const configKeywords = ['settings', 'configuration', 'not configured', 'setup', 'installation'];

    const isConfigIssue = configKeywords.some((keyword) => fullText.includes(keyword));

    return {
      isBug: !isFeatureRequest && !isConfigIssue && !isThirdParty,
      isThirdParty,
      rootCause: isThirdParty
        ? 'Third-party plugin or system limitation'
        : isConfigIssue
          ? 'Configuration or setup issue'
          : isFeatureRequest
            ? 'Feature request, not a bug'
            : undefined,
      suggestedSolution: undefined,
    };
  }

  stripHtml(html: string | null | undefined): string {
    if (!html) {
      return '';
    }

    return html
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp;
      .replace(/&lt;/g, '<') // Replace &lt;
      .replace(/&gt;/g, '>') // Replace &gt;
      .replace(/&quot;/g, '"') // Replace &quot;
      .replace(/&#39;/g, "'") // Replace &#39;
      .replace(/&amp;/g, '&') // Replace &amp; (decode ampersand last to avoid double-unescaping)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private looksLikeCode(line: string): boolean {
    const codeIndicators = [
      /^\s*\/\//, // Comments
      /^\s*#/, // Comments or directives
      /^\s*\*/, // Comments
      /function\s+\w+/, // Function declarations
      /class\s+\w+/, // Class declarations
      /\$\w+/, // PHP variables
      /\w+\s*\(\s*\)/, // Function calls
      /\w+\s*=\s*.+/, // Assignments
      /if\s*\(/, // Control structures
      /for\s*\(/,
      /while\s*\(/,
      /return\s+/,
      /import\s+/,
      /require\s*\(/,
      /include\s*\(/,
    ];

    return codeIndicators.some((pattern) => pattern.test(line));
  }

  generateCustomerReply(
    analysis: TicketAnalysis,
    fixDescription?: string,
    isExplanatory: boolean = false
  ): string {
    const customerFirstName = analysis.customerName.split(' ')[0] || 'there';

    if (isExplanatory) {
      return `Hi ${customerFirstName},

Thanks for reporting this. After investigating, I've found that ${analysis.rootCause || 'this is expected behavior'}.

${fixDescription || 'This is working as designed based on the current system architecture.'}

Please let me know if you have any questions or if there's anything else I can help clarify!`;
    }

    if (!analysis.isBug) {
      return `Hi ${customerFirstName},

Thanks for reaching out. ${analysis.rootCause || 'After reviewing your request, this appears to be a configuration or feature request rather than a bug.'}

${fixDescription || 'I can help you with the configuration, or we can consider this as a feature request for a future update.'}

Please let me know how you'd like to proceed!`;
    }

    return `Hi ${customerFirstName},

Thanks for reporting this. We were able to reproduce it on our end. We've implemented a fix that ${fixDescription || 'addresses the issue you reported'}.

The fix has been submitted for review and will be included in the next plugin update. You'll receive the update through WordPress's automatic update system.

Here's what was changed:
- ${fixDescription || 'Fixed the reported issue'}

Please let me know if you have any questions!`;
  }
}
