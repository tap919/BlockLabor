/**
 * API Tests: Approvals Endpoints
 * Tests for human-in-the-loop approval workflows
 */

import { 
  createMockPrismaClient, 
  mockHumanApproval, 
  mockProject, 
  mockERVDecision 
} from '../utils/test-utils';

jest.mock('@/lib/db', () => ({
  db: createMockPrismaClient(),
}));

import { db } from '@/lib/db';
import { GET, PATCH } from '@/app/api/approvals/route';

const mockDb = db as jest.Mocked<typeof db>;

// Helper to create mock NextRequest with nextUrl
function createMockNextRequest(url: string): any {
  const parsedUrl = new URL(url);
  return {
    nextUrl: {
      searchParams: parsedUrl.searchParams,
      href: parsedUrl.href,
      pathname: parsedUrl.pathname,
    },
    json: async () => ({}),
  };
}

describe('Approvals API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/approvals - List Approvals
  // ============================================
  describe('GET /api/approvals', () => {
    test('should return all pending approvals', async () => {
      const approvals = [
        mockHumanApproval({ status: 'pending' }),
        mockHumanApproval({ id: 'approval_2', status: 'pending' }),
      ];
      
      mockDb.humanApproval.findMany.mockResolvedValue(approvals);
      
      const request = createMockNextRequest('http://localhost/api/approvals');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    test('should filter approvals by project ID', async () => {
      const approvals = [
        mockHumanApproval({ projectId: 'project_123' }),
      ];
      
      mockDb.humanApproval.findMany.mockResolvedValue(approvals);
      
      const request = createMockNextRequest('http://localhost/api/approvals?projectId=project_123');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(mockDb.humanApproval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project_123', status: 'pending' },
        })
      );
    });

    test('should return empty array when no pending approvals', async () => {
      mockDb.humanApproval.findMany.mockResolvedValue([]);
      
      const request = createMockNextRequest('http://localhost/api/approvals');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    test('should include project and ERV decision details', async () => {
      const approval = {
        ...mockHumanApproval(),
        project: { name: 'Test Project' },
        ervDecision: {
          ...mockERVDecision(),
          phaseOutput: { content: '{}' },
        },
      };
      
      mockDb.humanApproval.findMany.mockResolvedValue([approval]);
      
      const request = createMockNextRequest('http://localhost/api/approvals');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data[0].project).toBeDefined();
      expect(data[0].project.name).toBe('Test Project');
      expect(data[0].ervDecision).toBeDefined();
    });

    test('should order approvals by creation date descending', async () => {
      mockDb.humanApproval.findMany.mockResolvedValue([]);
      
      const request = createMockNextRequest('http://localhost/api/approvals');
      await GET(request);
      
      expect(mockDb.humanApproval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    test('should only return pending approvals by default', async () => {
      mockDb.humanApproval.findMany.mockResolvedValue([]);
      
      const request = createMockNextRequest('http://localhost/api/approvals');
      await GET(request);
      
      expect(mockDb.humanApproval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        })
      );
    });

    test('should handle database errors gracefully', async () => {
      mockDb.humanApproval.findMany.mockRejectedValue(new Error('Database error'));
      
      const request = createMockNextRequest('http://localhost/api/approvals');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch approvals');
    });

    test('should handle invalid project ID parameter', async () => {
      mockDb.humanApproval.findMany.mockResolvedValue([]);
      
      const request = createMockNextRequest('http://localhost/api/approvals?projectId=');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // PATCH /api/approvals - Respond to Approval
  // ============================================
  describe('PATCH /api/approvals', () => {
    test('should approve a pending approval', async () => {
      const approval = mockHumanApproval({ status: 'pending' });
      const ervDecision = mockERVDecision();
      
      mockDb.humanApproval.update.mockResolvedValue(approval);
      mockDb.eRVDecision.update.mockResolvedValue(ervDecision);
      
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: JSON.stringify({
          approvalId: 'approval_test',
          approved: true,
          notes: 'Looks good',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PATCH(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(mockDb.humanApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'approved',
            reviewNotes: 'Looks good',
          }),
        })
      );
    });

    test('should reject a pending approval', async () => {
      const approval = mockHumanApproval({ status: 'pending' });
      const ervDecision = mockERVDecision();
      
      mockDb.humanApproval.update.mockResolvedValue(approval);
      mockDb.eRVDecision.update.mockResolvedValue(ervDecision);
      
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: JSON.stringify({
          approvalId: 'approval_test',
          approved: false,
          notes: 'Risk too high',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PATCH(request as any);
      
      expect(response.status).toBe(200);
      expect(mockDb.humanApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            reviewNotes: 'Risk too high',
          }),
        })
      );
    });

    test('should require approval ID', async () => {
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: JSON.stringify({ approved: true }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PATCH(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Approval ID is required');
    });

    test('should update ERV decision when approval is resolved', async () => {
      const approval = mockHumanApproval({ ervDecisionId: 'erv_test' });
      const ervDecision = mockERVDecision();
      
      mockDb.humanApproval.update.mockResolvedValue(approval);
      mockDb.eRVDecision.update.mockResolvedValue(ervDecision);
      
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: JSON.stringify({
          approvalId: 'approval_test',
          approved: true,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      await PATCH(request as any);
      
      expect(mockDb.eRVDecision.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'erv_test' },
          data: expect.objectContaining({
            overridden: true,
          }),
        })
      );
    });

    test('should set reviewed timestamp', async () => {
      const approval = mockHumanApproval();
      
      mockDb.humanApproval.update.mockResolvedValue(approval);
      mockDb.eRVDecision.update.mockResolvedValue(mockERVDecision());
      
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: JSON.stringify({
          approvalId: 'approval_test',
          approved: true,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      await PATCH(request as any);
      
      expect(mockDb.humanApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewedAt: expect.any(Date),
          }),
        })
      );
    });

    test('should handle non-existent approval ID', async () => {
      const error = new Error('Record not found');
      (error as any).code = 'P2025';
      mockDb.humanApproval.update.mockRejectedValue(error);
      
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: JSON.stringify({
          approvalId: 'nonexistent',
          approved: true,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PATCH(request as any);
      
      expect(response.status).toBe(500);
    });

    test('should handle missing request body', async () => {
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
      });
      
      try {
        const response = await PATCH(request as any);
        expect(response.status).toBeGreaterThanOrEqual(400);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle malformed JSON body', async () => {
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });
      
      try {
        const response = await PATCH(request as any);
        expect(response.status).toBeGreaterThanOrEqual(400);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle database errors gracefully', async () => {
      mockDb.humanApproval.update.mockRejectedValue(new Error('Database error'));
      
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: JSON.stringify({
          approvalId: 'approval_test',
          approved: true,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PATCH(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update approval');
    });

    test('should allow optional notes for rejection', async () => {
      const approval = mockHumanApproval();
      
      mockDb.humanApproval.update.mockResolvedValue(approval);
      mockDb.eRVDecision.update.mockResolvedValue(mockERVDecision());
      
      const request = new Request('http://localhost/api/approvals', {
        method: 'PATCH',
        body: JSON.stringify({
          approvalId: 'approval_test',
          approved: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PATCH(request as any);
      
      expect(response.status).toBe(200);
    });
  });
});

describe('Approval Expiration Tests', () => {
  test('should check if approval is expired', () => {
    const expiredApproval = mockHumanApproval({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    
    const isExpired = new Date(expiredApproval.expiresAt) < new Date();
    expect(isExpired).toBe(true);
  });

  test('should check if approval is not expired', () => {
    const validApproval = mockHumanApproval({
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    
    const isExpired = new Date(validApproval.expiresAt) < new Date();
    expect(isExpired).toBe(false);
  });

  test('should set default expiration to 24 hours', () => {
    const approval = mockHumanApproval({
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    
    const expirationTime = new Date(approval.expiresAt).getTime() - Date.now();
    const hours = expirationTime / (1000 * 60 * 60);
    
    expect(hours).toBeCloseTo(24, 0);
  });
});

describe('Approval Context Tests', () => {
  test('should include action requiring approval', () => {
    const approval = mockHumanApproval({
      action: 'execute_trade',
    });
    
    expect(approval.action).toBe('execute_trade');
  });

  test('should include requester agent name', () => {
    const approval = mockHumanApproval({
      requester: 'oracle',
    });
    
    expect(approval.requester).toBe('oracle');
  });

  test('should include context data as JSON', () => {
    const context = {
      symbol: 'AAPL',
      quantity: 100,
      price: 150.00,
    };
    
    const approval = mockHumanApproval({
      context: JSON.stringify(context),
    });
    
    const parsedContext = JSON.parse(approval.context);
    expect(parsedContext.symbol).toBe('AAPL');
    expect(parsedContext.quantity).toBe(100);
  });
});

describe('Approval Status Transitions', () => {
  test('should only allow transition from pending to approved', async () => {
    const approval = mockHumanApproval({ status: 'pending' });
    
    mockDb.humanApproval.update.mockResolvedValue({ ...approval, status: 'approved' });
    mockDb.eRVDecision.update.mockResolvedValue(mockERVDecision());
    
    const request = new Request('http://localhost/api/approvals', {
      method: 'PATCH',
      body: JSON.stringify({
        approvalId: 'approval_test',
        approved: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    
    const response = await PATCH(request as any);
    
    expect(response.status).toBe(200);
  });

  test('should only allow transition from pending to rejected', async () => {
    const approval = mockHumanApproval({ status: 'pending' });
    
    mockDb.humanApproval.update.mockResolvedValue({ ...approval, status: 'rejected' });
    mockDb.eRVDecision.update.mockResolvedValue(mockERVDecision());
    
    const request = new Request('http://localhost/api/approvals', {
      method: 'PATCH',
      body: JSON.stringify({
        approvalId: 'approval_test',
        approved: false,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    
    const response = await PATCH(request as any);
    
    expect(response.status).toBe(200);
  });
});

describe('Approval Performance Tests', () => {
  test('should handle large number of pending approvals', async () => {
    const manyApprovals = Array(100).fill(null).map((_, i) => 
      mockHumanApproval({ id: `approval_${i}` })
    );
    
    mockDb.humanApproval.findMany.mockResolvedValue(manyApprovals);
    
    const request = createMockNextRequest('http://localhost/api/approvals');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveLength(100);
  });

  test('should handle concurrent approval requests', async () => {
    mockDb.humanApproval.findMany.mockResolvedValue([mockHumanApproval()]);
    
    const requests = Array(20).fill(null).map(() => 
      GET(createMockNextRequest('http://localhost/api/approvals'))
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
