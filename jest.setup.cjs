// Jest setup file for global test configuration

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  // Keep log for debugging
  log: console.log,
  info: console.info,
  debug: console.debug,
};

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Helper to create mock FreeScout responses
  mockTicket: (overrides = {}) => ({
    id: 123,
    number: 456,
    subject: 'Test Ticket',
    status: 'active',
    state: 'published',
    createdBy: { id: 1, email: 'user@example.com' },
    customer: { id: 10, email: 'customer@example.com' },
    threads: [],
    cc: [],
    bcc: [],
    _embedded: {},
    ...overrides,
  }),

  mockThread: (overrides = {}) => ({
    id: 1,
    type: 'message',
    status: 'active',
    state: 'published',
    body: 'Test message',
    createdBy: { id: 1, email: 'user@example.com' },
    createdAt: new Date().toISOString(),
    ...overrides,
  }),
};

