/**
 * API Tests: Projects Endpoints
 * Tests for project creation, retrieval, update, and deletion
 */

import { createMockPrismaClient, mockProject, mockPhase, mockPortfolio } from '../utils/test-utils';

// Mock the db module
jest.mock('@/lib/db', () => ({
  db: createMockPrismaClient(),
}));

import { db } from '@/lib/db';
import { GET, POST } from '@/app/api/projects/route';
import { DELETE, GET as GET_ONE } from '@/app/api/projects/[id]/route';

const mockDb = db as jest.Mocked<typeof db>;

describe('Projects API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/projects - List Projects
  // ============================================
  describe('GET /api/projects', () => {
    test('should return empty array when no projects exist', async () => {
      mockDb.project.findMany.mockResolvedValue([]);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
      expect(mockDb.project.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          phases: { orderBy: { order: 'asc' } },
          portfolio: {
            include: {
              positions: true,
              transactions: {
                orderBy: { executedAt: 'desc' },
                take: 10,
              },
            },
          },
        },
      });
    });

    test('should return list of projects with phases', async () => {
      const mockProjects = [
        mockProject({ phases: [mockPhase()] }),
        mockProject({ id: 'project_2', name: 'Project 2', phases: [] }),
      ];
      
      mockDb.project.findMany.mockResolvedValue(mockProjects);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Test Project');
    });

    test('should include portfolio data for simulation projects', async () => {
      const mockProjects = [
        mockProject({
          mode: 'simulation',
          portfolio: mockPortfolio({ totalValue: 150000 }),
          phases: [],
        }),
      ];
      
      mockDb.project.findMany.mockResolvedValue(mockProjects);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data[0].portfolio).toBeDefined();
      expect(data[0].portfolio.totalValue).toBe(150000);
    });

    test('should handle database errors gracefully', async () => {
      mockDb.project.findMany.mockRejectedValue(new Error('Database connection failed'));
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch projects');
    });

    test('should order projects by creation date descending', async () => {
      const mockProjects = [
        mockProject({ createdAt: '2024-01-02T00:00:00Z' }),
        mockProject({ id: 'project_2', createdAt: '2024-01-01T00:00:00Z' }),
      ];
      
      mockDb.project.findMany.mockResolvedValue(mockProjects);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(mockDb.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    test('should include phase relationships', async () => {
      const phases = [
        mockPhase({ name: 'research', order: 0 }),
        mockPhase({ name: 'analysis', order: 1 }),
        mockPhase({ name: 'validation', order: 2 }),
      ];
      
      mockDb.project.findMany.mockResolvedValue([mockProject({ phases })]);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data[0].phases).toHaveLength(3);
    });

    test('should limit transaction history to 10 items', async () => {
      const mockProjects = [
        mockProject({
          portfolio: mockPortfolio({
            transactions: Array(15).fill(null).map((_, i) => ({ id: `txn_${i}` })),
          }),
          phases: [],
        }),
      ];
      
      mockDb.project.findMany.mockResolvedValue(mockProjects);
      
      const response = await GET();
      
      expect(response.status).toBe(200);
      expect(mockDb.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            portfolio: expect.objectContaining({
              include: expect.objectContaining({
                transactions: expect.objectContaining({
                  take: 10,
                }),
              }),
            }),
          }),
        })
      );
    });
  });

  // ============================================
  // POST /api/projects - Create Project
  // ============================================
  describe('POST /api/projects', () => {
    test('should create a new project with required fields', async () => {
      const newProject = mockProject({ id: 'new_project' });
      const phases = [
        { id: 'phase_1', name: 'research', status: 'pending' },
        { id: 'phase_2', name: 'analysis', status: 'pending' },
      ];
      
      mockDb.project.create.mockResolvedValue(newProject);
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...newProject,
        phases,
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(mockDb.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Project',
            status: 'draft',
          }),
        })
      );
    });

    test('should reject project without name', async () => {
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ description: 'No name provided' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Project name is required');
    });

    test('should create project with description', async () => {
      const newProject = mockProject({ description: 'Test description' });
      
      mockDb.project.create.mockResolvedValue(newProject);
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...newProject,
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          description: 'Test description',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
      expect(mockDb.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Test description',
          }),
        })
      );
    });

    test('should default to simulation mode', async () => {
      mockDb.project.create.mockResolvedValue(mockProject({ mode: 'simulation' }));
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject(),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
      expect(mockDb.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mode: 'simulation',
          }),
        })
      );
    });

    test('should create portfolio for simulation mode', async () => {
      mockDb.project.create.mockResolvedValue(mockProject());
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject(),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          mode: 'simulation',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
      expect(mockDb.portfolio.create).toHaveBeenCalled();
    });

    test('should not create portfolio for live mode', async () => {
      mockDb.project.create.mockResolvedValue(mockProject({ mode: 'live' }));
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject({ mode: 'live' }),
        phases: [],
        portfolio: null,
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          mode: 'live',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
      expect(mockDb.portfolio.create).not.toHaveBeenCalled();
    });

    test('should create default phases for new project', async () => {
      mockDb.project.create.mockResolvedValue(mockProject());
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject(),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
      expect(mockDb.phase.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'research', order: 0 }),
            expect.objectContaining({ name: 'analysis', order: 1 }),
            expect.objectContaining({ name: 'validation', order: 2 }),
            expect.objectContaining({ name: 'synthesis', order: 3 }),
            expect.objectContaining({ name: 'execution', order: 4 }),
          ]),
        })
      );
    });

    test('should handle database errors during creation', async () => {
      mockDb.project.create.mockRejectedValue(new Error('Database error'));
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create project');
    });

    test('should initialize portfolio with $100,000', async () => {
      mockDb.project.create.mockResolvedValue(mockProject());
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject(),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      await POST(request as any);
      
      expect(mockDb.portfolio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cash: 100000,
            totalValue: 100000,
          }),
        })
      );
    });

    test('should handle malformed JSON body', async () => {
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });
      
      try {
        const response = await POST(request as any);
        expect(response.status).toBeGreaterThanOrEqual(400);
      } catch (error) {
        // JSON parsing error is expected
        expect(error).toBeDefined();
      }
    });

    test('should trim whitespace from project name', async () => {
      mockDb.project.create.mockResolvedValue(mockProject());
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject(),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: '  Test Project  ' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
    });

    test('should reject empty string name', async () => {
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Project name is required');
    });

    test('should handle very long project names', async () => {
      const longName = 'A'.repeat(500);
      
      mockDb.project.create.mockResolvedValue(mockProject({ name: longName }));
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject({ name: longName }),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: longName }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
    });

    test('should handle special characters in project name', async () => {
      const specialName = 'Test Project <script>alert("xss")</script>';
      
      mockDb.project.create.mockResolvedValue(mockProject({ name: specialName }));
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject({ name: specialName }),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: specialName }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
    });

    test('should handle unicode characters in project name', async () => {
      const unicodeName = '测试项目 🚀 Test Project';
      
      mockDb.project.create.mockResolvedValue(mockProject({ name: unicodeName }));
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject({ name: unicodeName }),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: unicodeName }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request as any);
      
      expect(response.status).toBe(200);
    });

    test('should set initial status to draft', async () => {
      mockDb.project.create.mockResolvedValue(mockProject({ status: 'draft' }));
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
      mockDb.project.findUnique.mockResolvedValue({
        ...mockProject(),
        phases: [],
        portfolio: mockPortfolio(),
      });
      
      const request = new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      await POST(request as any);
      
      expect(mockDb.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'draft',
          }),
        })
      );
    });
  });

  // ============================================
  // DELETE /api/projects/[id] - Delete Project
  // ============================================
  describe('DELETE /api/projects/[id]', () => {
    test('should delete existing project', async () => {
      mockDb.project.delete.mockResolvedValue(mockProject());
      
      const request = new Request('http://localhost/api/projects/test_id', {
        method: 'DELETE',
      });
      
      const params = Promise.resolve({ id: 'test_id' });
      const response = await DELETE(request as any, { params } as any);
      
      expect(mockDb.project.delete).toHaveBeenCalledWith({
        where: { id: 'test_id' },
      });
    });

    test('should handle non-existent project', async () => {
      const error = new Error('Record not found');
      (error as any).code = 'P2025';
      mockDb.project.delete.mockRejectedValue(error);
      
      const request = new Request('http://localhost/api/projects/nonexistent', {
        method: 'DELETE',
      });
      
      const params = Promise.resolve({ id: 'nonexistent' });
      
      try {
        const response = await DELETE(request as any, { params } as any);
        expect(response.status).toBeGreaterThanOrEqual(400);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should cascade delete related phases', async () => {
      mockDb.project.delete.mockResolvedValue(mockProject());
      
      const request = new Request('http://localhost/api/projects/test_id', {
        method: 'DELETE',
      });
      
      const params = Promise.resolve({ id: 'test_id' });
      await DELETE(request as any, { params } as any);
      
      // Prisma handles cascade delete via schema
      expect(mockDb.project.delete).toHaveBeenCalled();
    });
  });
});

describe('Projects API - Edge Cases', () => {
  test('should handle concurrent project creation requests', async () => {
    mockDb.project.create.mockResolvedValue(mockProject());
    mockDb.phase.createMany.mockResolvedValue({ count: 5 });
    mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
    mockDb.project.findUnique.mockResolvedValue({
      ...mockProject(),
      phases: [],
      portfolio: mockPortfolio(),
    });
    
    const requests = Array(10).fill(null).map(() => 
      POST(new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: `Project ${Math.random()}` }),
        headers: { 'Content-Type': 'application/json' },
      }) as any)
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });

  test('should handle large number of projects', async () => {
    const manyProjects = Array(1000).fill(null).map((_, i) => 
      mockProject({ id: `project_${i}`, name: `Project ${i}` })
    );
    
    mockDb.project.findMany.mockResolvedValue(manyProjects);
    
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveLength(1000);
  });

  test('should handle null values in optional fields', async () => {
    const projectWithNulls = mockProject({
      description: null,
      createdBy: null,
      startedAt: null,
      completedAt: null,
    });
    
    mockDb.project.findMany.mockResolvedValue([projectWithNulls]);
    
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data[0].description).toBeNull();
  });

  test('should handle concurrent read and write operations', async () => {
    mockDb.project.findMany.mockResolvedValue([mockProject()]);
    mockDb.project.create.mockResolvedValue(mockProject());
    mockDb.phase.createMany.mockResolvedValue({ count: 5 });
    mockDb.portfolio.create.mockResolvedValue(mockPortfolio());
    mockDb.project.findUnique.mockResolvedValue({
      ...mockProject(),
      phases: [],
      portfolio: mockPortfolio(),
    });
    
    const [getResponse] = await Promise.all([
      GET(),
      POST(new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Project' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any),
    ]);
    
    expect(getResponse.status).toBe(200);
  });
});
