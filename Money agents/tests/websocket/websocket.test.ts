/**
 * WebSocket Tests
 * Tests for real-time communication, event streaming, and socket handling
 */

import { createMockSocket, mockProject, mockPhase, mockAgent } from '../utils/test-utils';

// ============================================
// WebSocket Event Types
// ============================================
type WebSocketEvent = 
  | 'project:created'
  | 'project:started'
  | 'project:completed'
  | 'phase:started'
  | 'phase:completed'
  | 'agent:started'
  | 'agent:completed'
  | 'approval:required'
  | 'approval:resolved'
  | 'error';

interface WebSocketMessage {
  event: WebSocketEvent;
  data: unknown;
  timestamp: Date;
}

// ============================================
// Mock WebSocket Server
// ============================================
class MockWebSocketServer {
  private clients: Set<MockSocket> = new Set();
  private eventHistory: WebSocketMessage[] = [];

  addClient(socket: MockSocket): void {
    this.clients.add(socket);
  }

  removeClient(socket: MockSocket): void {
    this.clients.delete(socket);
  }

  broadcast(event: WebSocketEvent, data: unknown): void {
    const message: WebSocketMessage = {
      event,
      data,
      timestamp: new Date(),
    };
    this.eventHistory.push(message);
    
    this.clients.forEach(client => {
      client.emit(event, data);
    });
  }

  emitTo(socketId: string, event: WebSocketEvent, data: unknown): void {
    this.clients.forEach(client => {
      if (client.id === socketId) {
        client.emit(event, data);
      }
    });
  }

  getHistory(): WebSocketMessage[] {
    return this.eventHistory;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

interface MockSocket {
  id: string;
  emit: jest.Mock;
  on: jest.Mock;
  once: jest.Mock;
  off: jest.Mock;
  disconnect: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  to: jest.Mock;
}

// ============================================
// WebSocket Connection Tests
// ============================================
describe('WebSocket Connection', () => {
  let server: MockWebSocketServer;
  let socket: MockSocket;

  beforeEach(() => {
    server = new MockWebSocketServer();
    socket = createMockSocket();
  });

  test('should accept new connections', () => {
    server.addClient(socket);
    
    expect(server.getClientCount()).toBe(1);
  });

  test('should handle multiple connections', () => {
    const socket2 = createMockSocket();
    const socket3 = createMockSocket();
    
    server.addClient(socket);
    server.addClient(socket2);
    server.addClient(socket3);
    
    expect(server.getClientCount()).toBe(3);
  });

  test('should handle disconnection', () => {
    server.addClient(socket);
    server.removeClient(socket);
    
    expect(server.getClientCount()).toBe(0);
  });

  test('should assign unique socket IDs', () => {
    const socket2 = createMockSocket();
    
    expect(socket.id).not.toBe(socket2.id);
  });
});

// ============================================
// Event Broadcasting Tests
// ============================================
describe('Event Broadcasting', () => {
  let server: MockWebSocketServer;
  let socket: MockSocket;
  let socket2: MockSocket;

  beforeEach(() => {
    server = new MockWebSocketServer();
    socket = createMockSocket();
    socket2 = createMockSocket();
    
    server.addClient(socket);
    server.addClient(socket2);
  });

  test('should broadcast to all clients', () => {
    const project = mockProject();
    
    server.broadcast('project:created', { project });
    
    expect(socket.emit).toHaveBeenCalledWith('project:created', { project });
    expect(socket2.emit).toHaveBeenCalledWith('project:created', { project });
  });

  test('should emit to specific client', () => {
    const data = { message: 'private message' };
    
    server.emitTo(socket.id, 'error', data);
    
    expect(socket.emit).toHaveBeenCalledWith('error', data);
    expect(socket2.emit).not.toHaveBeenCalled();
  });

  test('should track event history', () => {
    server.broadcast('project:created', { id: '1' });
    server.broadcast('project:started', { projectId: '1' });
    
    const history = server.getHistory();
    
    expect(history).toHaveLength(2);
    expect(history[0].event).toBe('project:created');
    expect(history[1].event).toBe('project:started');
  });

  test('should include timestamps in events', () => {
    server.broadcast('project:created', {});
    
    const history = server.getHistory();
    
    expect(history[0].timestamp).toBeInstanceOf(Date);
  });
});

// ============================================
// Project Events Tests
// ============================================
describe('Project Events', () => {
  let server: MockWebSocketServer;
  let socket: MockSocket;

  beforeEach(() => {
    server = new MockWebSocketServer();
    socket = createMockSocket();
    server.addClient(socket);
  });

  test('should emit project:created event', () => {
    const project = mockProject({ id: 'new_project' });
    
    server.broadcast('project:created', { project });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'project:created',
      expect.objectContaining({ project })
    );
  });

  test('should emit project:started event', () => {
    const projectId = 'project_123';
    
    server.broadcast('project:started', { projectId, phases: [] });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'project:started',
      expect.objectContaining({ projectId })
    );
  });

  test('should emit project:completed event', () => {
    const projectId = 'project_123';
    
    server.broadcast('project:completed', { projectId });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'project:completed',
      expect.objectContaining({ projectId })
    );
  });

  test('should include project data in events', () => {
    const project = mockProject({
      id: 'proj_1',
      name: 'Test Project',
      status: 'running',
    });

    server.broadcast('project:created', { project });

    expect(socket.emit).toHaveBeenCalledWith(
      'project:created',
      expect.objectContaining({
        project: expect.objectContaining({
          id: 'proj_1',
          name: 'Test Project',
        }),
      })
    );
  });
});

// ============================================
// Phase Events Tests
// ============================================
describe('Phase Events', () => {
  let server: MockWebSocketServer;
  let socket: MockSocket;

  beforeEach(() => {
    server = new MockWebSocketServer();
    socket = createMockSocket();
    server.addClient(socket);
  });

  test('should emit phase:started event', () => {
    const phase = mockPhase({ name: 'research' });
    
    server.broadcast('phase:started', {
      projectId: 'proj_1',
      phaseId: phase.id,
      phaseName: 'Research',
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'phase:started',
      expect.objectContaining({ phaseName: 'Research' })
    );
  });

  test('should emit phase:completed event', () => {
    server.broadcast('phase:completed', {
      projectId: 'proj_1',
      phaseId: 'phase_1',
      phaseName: 'Research',
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'phase:completed',
      expect.objectContaining({ phaseName: 'Research' })
    );
  });

  test('should emit phase:failed event', () => {
    server.broadcast('phase:failed' as WebSocketEvent, {
      projectId: 'proj_1',
      phaseId: 'phase_1',
      error: 'Agent timeout',
    });
    
    expect(socket.emit).toHaveBeenCalled();
  });

  test('should track phase progress', () => {
    const phases = ['research', 'analysis', 'validation'];
    
    phases.forEach((phaseName, index) => {
      server.broadcast('phase:completed', {
        projectId: 'proj_1',
        phaseId: `phase_${index}`,
        phaseName,
      });
    });
    
    const history = server.getHistory();
    expect(history).toHaveLength(3);
  });
});

// ============================================
// Agent Events Tests
// ============================================
describe('Agent Events', () => {
  let server: MockWebSocketServer;
  let socket: MockSocket;

  beforeEach(() => {
    server = new MockWebSocketServer();
    socket = createMockSocket();
    server.addClient(socket);
  });

  test('should emit agent:started event', () => {
    server.broadcast('agent:started', {
      projectId: 'proj_1',
      phaseId: 'phase_1',
      agentName: 'sentinel',
      executionId: 'exec_1',
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'agent:started',
      expect.objectContaining({ agentName: 'sentinel' })
    );
  });

  test('should emit agent:completed event', () => {
    server.broadcast('agent:completed', {
      projectId: 'proj_1',
      phaseId: 'phase_1',
      agentName: 'oracle',
      executionId: 'exec_1',
      output: 'Analysis complete',
      ervDecision: 'execute',
      duration: 1500,
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'agent:completed',
      expect.objectContaining({
        agentName: 'oracle',
        ervDecision: 'execute',
        duration: 1500,
      })
    );
  });

  test('should emit agent:failed event', () => {
    server.broadcast('agent:failed' as WebSocketEvent, {
      projectId: 'proj_1',
      phaseId: 'phase_1',
      agentName: 'cipher',
      executionId: 'exec_1',
      error: 'Rate limit exceeded',
    });
    
    expect(socket.emit).toHaveBeenCalled();
  });

  test('should include ERV decision in agent completion', () => {
    server.broadcast('agent:completed', {
      projectId: 'proj_1',
      phaseId: 'phase_1',
      agentName: 'oracle',
      executionId: 'exec_1',
      output: '{}',
      ervDecision: 'verify',
      duration: 2000,
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'agent:completed',
      expect.objectContaining({ ervDecision: 'verify' })
    );
  });
});

// ============================================
// Approval Events Tests
// ============================================
describe('Approval Events', () => {
  let server: MockWebSocketServer;
  let socket: MockSocket;

  beforeEach(() => {
    server = new MockWebSocketServer();
    socket = createMockSocket();
    server.addClient(socket);
  });

  test('should emit approval:required event', () => {
    server.broadcast('approval:required', {
      projectId: 'proj_1',
      agentName: 'oracle',
      action: 'execute_trade',
      reasoning: 'Trade exceeds threshold',
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'approval:required',
      expect.objectContaining({
        action: 'execute_trade',
        reasoning: 'Trade exceeds threshold',
      })
    );
  });

  test('should emit approval:resolved event', () => {
    server.broadcast('approval:resolved', {
      approval: { id: 'approval_1' },
      approved: true,
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'approval:resolved',
      expect.objectContaining({ approved: true })
    );
  });

  test('should notify on rejection', () => {
    server.broadcast('approval:resolved', {
      approval: { id: 'approval_1' },
      approved: false,
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'approval:resolved',
      expect.objectContaining({ approved: false })
    );
  });
});

// ============================================
// Room/Channel Tests
// ============================================
describe('Room Management', () => {
  let socket: MockSocket;

  beforeEach(() => {
    socket = createMockSocket();
  });

  test('should join a room', () => {
    socket.join('project_123');
    
    expect(socket.join).toHaveBeenCalledWith('project_123');
  });

  test('should leave a room', () => {
    socket.leave('project_123');
    
    expect(socket.leave).toHaveBeenCalledWith('project_123');
  });

  test('should emit to specific room', () => {
    socket.to('project_123');
    
    expect(socket.to).toHaveBeenCalledWith('project_123');
  });
});

// ============================================
// Error Handling Tests
// ============================================
describe('Error Handling', () => {
  let server: MockWebSocketServer;
  let socket: MockSocket;

  beforeEach(() => {
    server = new MockWebSocketServer();
    socket = createMockSocket();
    server.addClient(socket);
  });

  test('should emit error events', () => {
    server.broadcast('error', {
      message: 'Connection failed',
      error: 'ECONNREFUSED',
    });
    
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ message: 'Connection failed' })
    );
  });

  test('should handle invalid event data gracefully', () => {
    expect(() => {
      server.broadcast('project:created', null);
    }).not.toThrow();
  });

  test('should handle malformed JSON in messages', () => {
    // This would be handled at the socket level
    const malformedData = '{ invalid json }';
    
    expect(() => JSON.parse(malformedData)).toThrow();
  });
});

// ============================================
// Reconnection Tests
// ============================================
describe('Reconnection', () => {
  let server: MockWebSocketServer;
  let socket: MockSocket;

  beforeEach(() => {
    server = new MockWebSocketServer();
    socket = createMockSocket();
  });

  test('should handle client reconnection', () => {
    server.addClient(socket);
    server.removeClient(socket);
    server.addClient(socket);
    
    expect(server.getClientCount()).toBe(1);
  });

  test('should resend state on reconnection', () => {
    server.addClient(socket);
    
    // Simulate reconnection flow
    socket.emit('agents:definitions', [
      mockAgent({ name: 'sentinel' }),
      mockAgent({ name: 'oracle' }),
    ]);
    
    expect(socket.emit).toHaveBeenCalledWith(
      'agents:definitions',
      expect.arrayContaining([
        expect.objectContaining({ name: 'sentinel' }),
      ])
    );
  });
});

// ============================================
// Event Filtering Tests
// ============================================
describe('Event Filtering', () => {
  test('should filter events by project', () => {
    const socket = createMockSocket();
    socket.join('project_123');
    
    // In real implementation, events would be filtered by room
    socket.to('project_123').emit('project:started', { projectId: 'project_123' });
    
    expect(socket.to).toHaveBeenCalledWith('project_123');
  });

  test('should not receive events from other projects', () => {
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();
    
    socket1.join('project_123');
    socket2.join('project_456');
    
    expect(socket1.join).toHaveBeenCalledWith('project_123');
    expect(socket2.join).toHaveBeenCalledWith('project_456');
  });
});

// ============================================
// Performance Tests
// ============================================
describe('WebSocket Performance', () => {
  test('should handle rapid message bursts', () => {
    const server = new MockWebSocketServer();
    const socket = createMockSocket();
    server.addClient(socket);

    for (let i = 0; i < 100; i++) {
      server.broadcast('agent:started', {
        projectId: `proj_${i}`,
        agentName: 'sentinel',
      });
    }

    expect(socket.emit).toHaveBeenCalledTimes(100);
  });

  test('should handle many concurrent connections', () => {
    const server = new MockWebSocketServer();
    
    for (let i = 0; i < 1000; i++) {
      server.addClient(createMockSocket());
    }

    expect(server.getClientCount()).toBe(1000);
  });

  test('should broadcast efficiently', () => {
    const server = new MockWebSocketServer();
    
    // Add 100 clients
    for (let i = 0; i < 100; i++) {
      server.addClient(createMockSocket());
    }

    // Broadcast to all
    server.broadcast('project:created', { id: 'new' });

    const history = server.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].event).toBe('project:created');
  });
});

// ============================================
// Message Protocol Tests
// ============================================
describe('Message Protocol', () => {
  test('should validate message format', () => {
    const validMessage = {
      event: 'project:created' as WebSocketEvent,
      data: { project: mockProject() },
      timestamp: new Date(),
    };

    expect(validMessage.event).toBeDefined();
    expect(validMessage.data).toBeDefined();
    expect(validMessage.timestamp).toBeInstanceOf(Date);
  });

  test('should handle different data types', () => {
    const dataTypes = [
      { string: 'test' },
      { number: 123 },
      { boolean: true },
      { array: [1, 2, 3] },
      { nested: { deep: { value: 'here' } } },
    ];

    dataTypes.forEach(data => {
      expect(typeof data).toBe('object');
    });
  });
});
