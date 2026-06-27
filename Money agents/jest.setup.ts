import '@testing-library/jest-dom';

// Mock Next.js Request and Response
class MockRequest {
  method: string;
  headers: Map<string, string>;
  private _body: string;
  
  constructor(input: string | URL, init?: RequestInit) {
    this.method = init?.method || 'GET';
    this.headers = new Map(Object.entries(init?.headers || {}));
    this._body = init?.body as string || '';
  }

  async json() {
    return JSON.parse(this._body);
  }

  async text() {
    return this._body;
  }
}

class MockResponse {
  status: number;
  statusText: string;
  headers: Map<string, string>;
  private _body: string;

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this.status = init?.status || 200;
    this.statusText = init?.statusText || '';
    this.headers = new Map(Object.entries(init?.headers || {}));
    this._body = body as string || '';
  }

  async json() {
    return JSON.parse(this._body);
  }

  async text() {
    return this._body;
  }

  static json(data: unknown, init?: ResponseInit) {
    return new MockResponse(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  }
}

// @ts-expect-error - Mock for tests
global.Request = MockRequest;
// @ts-expect-error - Mock for tests
global.Response = MockResponse;

// Mock NextResponse
jest.mock('next/server', () => ({
  NextRequest: MockRequest,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => {
      return {
        status: init?.status || 200,
        json: async () => data,
      };
    },
  },
}));

// Mock crypto for hash functions
const crypto = require('crypto');
Object.defineProperty(global, 'crypto', {
  value: {
    ...crypto,
    subtle: {
      digest: async (algorithm: string, data: BufferSource) => {
        const algo = algorithm.toLowerCase().replace('-', '');
        const buf = algorithm.includes('256') ? crypto.createHash('sha256') : crypto.createHash('sha1');
        buf.update(Buffer.from(data as ArrayBuffer));
        return buf.digest();
      },
    },
    randomUUID: () => crypto.randomUUID(),
  },
});

// Suppress console logs during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
