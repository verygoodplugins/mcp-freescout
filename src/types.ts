export interface FreeScoutThread {
  id: number;
  type: 'customer' | 'message' | 'note';
  body: string;
  created_by_customer: boolean;
  created_at: string;
  attachments?: Array<{
    id: number;
    file_name: string;
    mime_type: string;
    size: number;
    url?: string;
  }>;
}

export interface FreeScoutCustomer {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
}

export interface FreeScoutConversation {
  id: number;
  number: number;
  subject: string;
  status: 'active' | 'pending' | 'closed' | 'spam';
  user_id: number | null;
  customer_id: number;
  mailbox_id: number;
  created_at: string;
  updated_at: string;
  _embedded?: {
    threads?: FreeScoutThread[];
    customer?: FreeScoutCustomer;
  };
}

export interface FreeScoutApiResponse<T> {
  _embedded?: {
    conversations?: T[];
    threads?: FreeScoutThread[];
    customer?: FreeScoutCustomer;
  };
  data?: T;
  page?: {
    size: number;
    total_elements: number;
    total_pages: number;
    number: number;
  };
}

export interface TicketAnalysis {
  ticketId: string;
  customerName: string;
  customerEmail: string;
  issueDescription: string;
  hasAttachments: boolean;
  attachments: string[];
  codeSnippets: string[];
  errorMessages: string[];
  isReproducible: boolean;
  testedByTeam: boolean;
  suggestedSolution?: string;
  isBug: boolean;
  isThirdPartyIssue: boolean;
  rootCause?: string;
}

export interface ImplementationPlan {
  issue: string;
  rootCause: string;
  solution: string;
  filesToModify: string[];
  alternativeApproaches: string[];
  hasBreakingChanges: boolean;
}