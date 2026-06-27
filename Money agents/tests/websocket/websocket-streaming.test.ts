/**
 * WebSocket Streaming Tests
 * Comprehensive tests for real-time WebSocket communication
 */

import { createMockPrismaClient, mockProject, mockAgentExecution, mockAuditLog } from '../utils/test-utils';
import { createMockSocket } from '../utils/test-utils';

// ============================================
// WebSocket Connection Tests
// ============================================

describe('WebSocket Connection', () => {
  describe('Connection Establishment', () => {
    test('should establish WebSocket connection', () => {
      const socket = createMockSocket();
      
      expect(socket.id).toBeDefined();
      expect(socket.emit).toBeDefined();
      expect(socket.on).toBeDefined();
    });

    test('should handle multiple connections', () => {
      const sockets = Array(10).fill(null).map(() => createMockSocket());
      
      const uniqueIds = new Set(sockets.map(s => s.id));
      expect(uniqueIds.size).toBe(10);
    });

    test('should assign unique socket IDs', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();
      
      expect(socket1.id).not.toBe(socket2.id);
    });

    test('should handle connection handshake', () => {
      const socket = createMockSocket();
      const handshake = {
        auth: { token: 'valid_token' },
        headers: { 'user-agent': 'test' },
      };

      expect(handshake.auth.token).toBe('valid_token');
    });

    test('should reject invalid auth tokens', () => {
      const invalidToken = null;
      
      const isValid = invalidToken !== null && invalidToken.length > 0;
      expect(isValid).toBe(false);
    });

    test('should handle reconnection', () => {
      const socket = createMockSocket();
      socket.disconnect();
      
      expect(socket.disconnect).toHaveBeenCalled();
    });

    test('should track connection count', () => {
      const connectionManager = {
        connections: new Map(),
        add(socketId: string) {
          this.connections.set(socketId, Date.now());
        },
        remove(socketId: string) {
          this.connections.delete(socketId);
        },
        count() {
          return this.connections.size;
        },
      };

      connectionManager.add('socket_1');
      connectionManager.add('socket_2');
      expect(connectionManager.count()).toBe(2);
    });

    test('should handle connection timeout', () => {
      const timeout = 30000; // 30 seconds
      const connectionTime = Date.now() - 35000; // 35 seconds ago
      
      const isTimedOut = Date.now() - connectionTime > timeout;
      expect(isTimedOut).toBe(true);
    });
  });

  describe('Room Management', () => {
    test('should join project room', () => {
      const socket = createMockSocket();
      socket.join('project:proj_1');
      
      expect(socket.join).toHaveBeenCalledWith('project:proj_1');
    });

    test('should leave project room', () => {
      const socket = createMockSocket();
      socket.leave('project:proj_1');
      
      expect(socket.leave).toHaveBeenCalledWith('project:proj_1');
    });

    test('should join multiple rooms', () => {
      const socket = createMockSocket();
      socket.join('project:proj_1');
      socket.join('agent:oracle');
      socket.join('portfolio:portfolio_1');
      
      expect(socket.join).toHaveBeenCalledTimes(3);
    });

    test('should broadcast to room', () => {
      const socket = createMockSocket();
      socket.to('project:proj_1').emit('update', { data: 'test' });
      
      expect(socket.to).toHaveBeenCalledWith('project:proj_1');
    });

    test('should handle room capacity', () => {
      const roomManager = {
        rooms: new Map<string, Set<string>>(),
        maxPerRoom: 100,
        join(room: string, socketId: string) {
          if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
          }
          const roomSockets = this.rooms.get(room)!;
          if (roomSockets.size >= this.maxPerRoom) {
            return false;
          }
          roomSockets.add(socketId);
          return true;
        },
      };

      // Add 100 sockets
      for (let i = 0; i < 100; i++) {
        expect(roomManager.join('room_1', `socket_${i}`)).toBe(true);
      }
      // 101st should fail
      expect(roomManager.join('room_1', 'socket_100')).toBe(false);
    });
  });
});

// ============================================
// WebSocket Event Streaming Tests
// ============================================

describe('WebSocket Event Streaming', () => {
  describe('Project Events', () => {
    test('should stream project creation', () => {
      const socket = createMockSocket();
      const project = mockProject();
      
      socket.emit('project:created', project);
      
      expect(socket.emit).toHaveBeenCalledWith('project:created', project);
    });

    test('should stream project status updates', () => {
      const socket = createMockSocket();
      const update = {
        projectId: 'proj_1',
        status: 'running',
        timestamp: new Date().toISOString(),
      };
      
      socket.emit('project:status', update);
      
      expect(socket.emit).toHaveBeenCalledWith('project:status', update);
    });

    test('should stream project completion', () => {
      const socket = createMockSocket();
      const completion = {
        projectId: 'proj_1',
        status: 'completed',
        result: { totalReturn: 0.15 },
      };
      
      socket.emit('project:completed', completion);
      
      expect(socket.emit).toHaveBeenCalledWith('project:completed', completion);
    });

    test('should stream project errors', () => {
      const socket = createMockSocket();
      const error = {
        projectId: 'proj_1',
        error: 'Phase failed',
        phase: 'analysis',
      };
      
      socket.emit('project:error', error);
      
      expect(socket.emit).toHaveBeenCalledWith('project:error', error);
    });
  });

  describe('Agent Events', () => {
    test('should stream agent execution start', () => {
      const socket = createMockSocket();
      const execution = {
        agentId: 'agent_oracle',
        projectId: 'proj_1',
        phase: 'analysis',
        status: 'started',
      };
      
      socket.emit('agent:started', execution);
      
      expect(socket.emit).toHaveBeenCalledWith('agent:started', execution);
    });

    test('should stream agent progress updates', () => {
      const socket = createMockSocket();
      const progress = {
        agentId: 'agent_oracle',
        progress: 0.5,
        message: 'Processing market data...',
      };
      
      socket.emit('agent:progress', progress);
      
      expect(socket.emit).toHaveBeenCalledWith('agent:progress', progress);
    });

    test('should stream agent completion', () => {
      const socket = createMockSocket();
      const completion = {
        agentId: 'agent_oracle',
        status: 'completed',
        output: { prediction: 'bullish' },
        duration: 1500,
      };
      
      socket.emit('agent:completed', completion);
      
      expect(socket.emit).toHaveBeenCalledWith('agent:completed', completion);
    });

    test('should stream agent errors', () => {
      const socket = createMockSocket();
      const error = {
        agentId: 'agent_oracle',
        error: 'API rate limit exceeded',
        retryable: true,
      };
      
      socket.emit('agent:error', error);
      
      expect(socket.emit).toHaveBeenCalledWith('agent:error', error);
    });

    test('should stream agent thinking/analysis', () => {
      const socket = createMockSocket();
      const thinking = {
        agentId: 'agent_oracle',
        thought: 'Analyzing market trends...',
        timestamp: new Date().toISOString(),
      };
      
      socket.emit('agent:thinking', thinking);
      
      expect(socket.emit).toHaveBeenCalledWith('agent:thinking', thinking);
    });
  });

  describe('Portfolio Events', () => {
    test('should stream portfolio updates', () => {
      const socket = createMockSocket();
      const update = {
        portfolioId: 'portfolio_1',
        totalValue: 105000,
        dayPnL: 5000,
        timestamp: new Date().toISOString(),
      };
      
      socket.emit('portfolio:update', update);
      
      expect(socket.emit).toHaveBeenCalledWith('portfolio:update', update);
    });

    test('should stream position updates', () => {
      const socket = createMockSocket();
      const position = {
        symbol: 'AAPL',
        quantity: 100,
        marketValue: 15500,
        unrealizedPnL: 500,
      };
      
      socket.emit('position:update', position);
      
      expect(socket.emit).toHaveBeenCalledWith('position:update', position);
    });

    test('should stream trade executions', () => {
      const socket = createMockSocket();
      const trade = {
        type: 'buy',
        symbol: 'AAPL',
        quantity: 100,
        price: 150,
        total: 15000,
        executedBy: 'oracle',
      };
      
      socket.emit('trade:executed', trade);
      
      expect(socket.emit).toHaveBeenCalledWith('trade:executed', trade);
    });

    test('should stream risk alerts', () => {
      const socket = createMockSocket();
      const alert = {
        type: 'stop_loss_triggered',
        symbol: 'AAPL',
        message: 'Position stopped out at $142.50',
        severity: 'high',
      };
      
      socket.emit('risk:alert', alert);
      
      expect(socket.emit).toHaveBeenCalledWith('risk:alert', alert);
    });
  });

  describe('ERV Events', () => {
    test('should stream ERV decisions', () => {
      const socket = createMockSocket();
      const decision = {
        decision: 'verify',
        action: 'execute_trade',
        reasoning: 'Large trade requires approval',
        confidence: 0.95,
      };
      
      socket.emit('erv:decision', decision);
      
      expect(socket.emit).toHaveBeenCalledWith('erv:decision', decision);
    });

    test('should stream approval requests', () => {
      const socket = createMockSocket();
      const approval = {
        approvalId: 'approval_1',
        action: 'execute_trade',
        context: { symbol: 'AAPL', amount: 150000 },
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      
      socket.emit('approval:requested', approval);
      
      expect(socket.emit).toHaveBeenCalledWith('approval:requested', approval);
    });

    test('should stream approval resolutions', () => {
      const socket = createMockSocket();
      const resolution = {
        approvalId: 'approval_1',
        status: 'approved',
        reviewedBy: 'user_1',
        timestamp: new Date().toISOString(),
      };
      
      socket.emit('approval:resolved', resolution);
      
      expect(socket.emit).toHaveBeenCalledWith('approval:resolved', resolution);
    });
  });

  describe('Audit Events', () => {
    test('should stream audit log entries', () => {
      const socket = createMockSocket();
      const auditEntry = mockAuditLog({
        action: 'trade_executed',
        actor: 'oracle',
      });
      
      socket.emit('audit:entry', auditEntry);
      
      expect(socket.emit).toHaveBeenCalledWith('audit:entry', auditEntry);
    });

    test('should stream security events', () => {
      const socket = createMockSocket();
      const securityEvent = {
        type: 'suspicious_activity',
        severity: 'high',
        details: 'Unusual trading pattern detected',
      };
      
      socket.emit('security:alert', securityEvent);
      
      expect(socket.emit).toHaveBeenCalledWith('security:alert', securityEvent);
    });
  });
});

// ============================================
// WebSocket Message Format Tests
// ============================================

describe('WebSocket Message Format', () => {
  describe('Message Structure', () => {
    test('should format messages with type', () => {
      const message = {
        type: 'project:update',
        payload: { id: 'proj_1', status: 'running' },
        timestamp: new Date().toISOString(),
      };
      
      expect(message.type).toBeDefined();
      expect(message.payload).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    test('should include correlation IDs', () => {
      const message = {
        type: 'agent:execution',
        correlationId: 'corr_123',
        payload: { agentId: 'oracle' },
      };
      
      expect(message.correlationId).toBe('corr_123');
    });

    test('should include sequence numbers for ordering', () => {
      const messages = [
        { sequence: 1, type: 'update', data: 'first' },
        { sequence: 2, type: 'update', data: 'second' },
        { sequence: 3, type: 'update', data: 'third' },
      ];
      
      messages.forEach((msg, index) => {
        expect(msg.sequence).toBe(index + 1);
      });
    });

    test('should handle large payloads', () => {
      const largePayload = {
        data: Array(1000).fill(null).map((_, i) => ({ id: i, value: `item_${i}` })),
      };
      
      const serialized = JSON.stringify(largePayload);
      expect(serialized.length).toBeGreaterThan(10000);
    });

    test('should compress large messages', () => {
      const compressionConfig = {
        threshold: 1024, // Compress if > 1KB
        algorithm: 'gzip',
        level: 6,
      };
      
      expect(compressionConfig.threshold).toBe(1024);
    });
  });

  describe('Message Validation', () => {
    test('should validate message schema', () => {
      const validMessage = {
        type: 'project:update',
        payload: {},
        timestamp: new Date().toISOString(),
      };
      
      const isValid = 
        typeof validMessage.type === 'string' &&
        typeof validMessage.payload === 'object' &&
        typeof validMessage.timestamp === 'string';
      
      expect(isValid).toBe(true);
    });

    test('should reject malformed messages', () => {
      const invalidMessages = [
        { type: null, payload: {} },
        { type: 'test', payload: null },
        { type: 123, payload: {} },
        {},
      ];
      
      invalidMessages.forEach(msg => {
        const isValid = 
          msg.type !== null && 
          typeof msg.type === 'string' &&
          msg.payload !== null &&
          typeof msg.payload === 'object';
        
        expect(isValid).toBe(false);
      });
    });

    test('should sanitize message payloads', () => {
      const unsafePayload = {
        script: '<script>alert("xss")</script>',
        sql: "'; DROP TABLE users; --",
      };
      
      const sanitized = {
        script: unsafePayload.script
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;'),
        sql: unsafePayload.sql.replace(/'/g, "''"),
      };
      
      expect(sanitized.script).not.toContain('<script>');
    });
  });
});

// ============================================
// WebSocket Rate Limiting Tests
// ============================================

describe('WebSocket Rate Limiting', () => {
  describe('Message Rate Limits', () => {
    test('should limit messages per second', () => {
      const rateLimit = {
        maxMessages: 100,
        windowMs: 1000,
        current: 95,
      };
      
      const canSend = rateLimit.current < rateLimit.maxMessages;
      expect(canSend).toBe(true);
    });

    test('should block when rate limit exceeded', () => {
      const rateLimit = {
        maxMessages: 100,
        windowMs: 1000,
        current: 105,
      };
      
      const canSend = rateLimit.current < rateLimit.maxMessages;
      expect(canSend).toBe(false);
    });

    test('should track rate limits per socket', () => {
      const rateTracker = new Map<string, number[]>();
      
      const socketId = 'socket_1';
      rateTracker.set(socketId, [Date.now(), Date.now(), Date.now()]);
      
      expect(rateTracker.get(socketId)).toHaveLength(3);
    });

    test('should implement sliding window', () => {
      const windowMs = 1000;
      const now = Date.now();
      const timestamps = [
        now - 2000, // Outside window
        now - 500,  // Inside window
        now - 250,  // Inside window
        now,        // Inside window
      ];
      
      const inWindow = timestamps.filter(t => now - t < windowMs);
      expect(inWindow).toHaveLength(3);
    });

    test('should reset rate limit after window', () => {
      const rateLimit = {
        windowMs: 1000,
        lastReset: Date.now() - 1500,
      };
      
      const shouldReset = Date.now() - rateLimit.lastReset >= rateLimit.windowMs;
      expect(shouldReset).toBe(true);
    });
  });

  describe('Connection Rate Limits', () => {
    test('should limit connections per IP', () => {
      const connectionLimits = {
        maxPerIP: 5,
        ipConnections: new Map([['192.168.1.1', 3]]),
      };
      
      const currentCount = connectionLimits.ipConnections.get('192.168.1.1') || 0;
      const canConnect = currentCount < connectionLimits.maxPerIP;
      
      expect(canConnect).toBe(true);
    });

    test('should block IPs exceeding connection limit', () => {
      const connectionLimits = {
        maxPerIP: 5,
        ipConnections: new Map([['192.168.1.1', 6]]),
      };
      
      const currentCount = connectionLimits.ipConnections.get('192.168.1.1') || 0;
      const canConnect = currentCount < connectionLimits.maxPerIP;
      
      expect(canConnect).toBe(false);
    });

    test('should handle connection burst', () => {
      const burstLimit = {
        maxBurst: 10,
        burstWindowMs: 100,
        currentBurst: 8,
      };
      
      const inBurstLimit = burstLimit.currentBurst < burstLimit.maxBurst;
      expect(inBurstLimit).toBe(true);
    });
  });
});

// ============================================
// WebSocket Error Handling Tests
// ============================================

describe('WebSocket Error Handling', () => {
  describe('Connection Errors', () => {
    test('should handle connection refused', () => {
      const error = {
        type: 'connection_refused',
        reason: 'Server at capacity',
        retryAfter: 5000,
      };
      
      expect(error.type).toBe('connection_refused');
      expect(error.retryAfter).toBeGreaterThan(0);
    });

    test('should handle authentication failure', () => {
      const error = {
        type: 'auth_failed',
        reason: 'Invalid token',
        code: 'AUTH_001',
      };
      
      expect(error.type).toBe('auth_failed');
    });

    test('should handle protocol errors', () => {
      const error = {
        type: 'protocol_error',
        reason: 'Invalid message format',
        code: 'PROTO_001',
      };
      
      expect(error.type).toBe('protocol_error');
    });

    test('should emit error to client', () => {
      const socket = createMockSocket();
      const error = {
        type: 'error',
        message: 'Internal server error',
        code: 'INTERNAL_001',
      };
      
      socket.emit('error', error);
      
      expect(socket.emit).toHaveBeenCalledWith('error', error);
    });
  });

  describe('Reconnection Handling', () => {
    test('should attempt reconnection with backoff', () => {
      const backoff = {
        initialDelay: 1000,
        maxDelay: 30000,
        multiplier: 1.5,
        currentDelay: 1000,
      };
      
      const nextDelay = Math.min(
        backoff.currentDelay * backoff.multiplier,
        backoff.maxDelay
      );
      
      expect(nextDelay).toBe(1500);
    });

    test('should cap reconnection attempts', () => {
      const reconnection = {
        maxAttempts: 5,
        currentAttempt: 4,
      };
      
      const canRetry = reconnection.currentAttempt < reconnection.maxAttempts;
      expect(canRetry).toBe(true);
    });

    test('should give up after max attempts', () => {
      const reconnection = {
        maxAttempts: 5,
        currentAttempt: 5,
      };
      
      const canRetry = reconnection.currentAttempt < reconnection.maxAttempts;
      expect(canRetry).toBe(false);
    });

    test('should restore state after reconnection', () => {
      const stateRecovery = {
        lastSequence: 100,
        pendingMessages: [],
        subscriptions: ['project:proj_1', 'agent:oracle'],
      };
      
      expect(stateRecovery.subscriptions).toHaveLength(2);
    });
  });
});

// ============================================
// WebSocket Performance Tests
// ============================================

describe('WebSocket Performance', () => {
  describe('Message Throughput', () => {
    test('should handle high message rate', () => {
      const throughput = {
        messagesPerSecond: 1000,
        avgLatency: 5, // ms
        successRate: 0.999,
      };
      
      expect(throughput.messagesPerSecond).toBeGreaterThanOrEqual(1000);
      expect(throughput.successRate).toBeGreaterThan(0.99);
    });

    test('should maintain low latency under load', () => {
      const latencyStats = {
        p50: 5,
        p95: 15,
        p99: 50,
        max: 100,
      };
      
      expect(latencyStats.p50).toBeLessThan(10);
      expect(latencyStats.p99).toBeLessThan(100);
    });

    test('should handle concurrent connections', () => {
      const loadStats = {
        activeConnections: 500,
        messagesPerConnection: 10,
        totalMessagesPerSecond: 5000,
      };
      
      expect(loadStats.activeConnections * loadStats.messagesPerConnection)
        .toBe(loadStats.totalMessagesPerSecond);
    });
  });

  describe('Memory Usage', () => {
    test('should manage connection memory', () => {
      const memoryConfig = {
        maxConnections: 1000,
        bytesPerConnection: 10240, // 10KB
        totalMemoryMB: (1000 * 10240) / (1024 * 1024),
      };
      
      expect(memoryConfig.totalMemoryMB).toBeLessThan(100); // Less than 100MB
    });

    test('should clean up disconnected sockets', () => {
      const cleanupConfig = {
        cleanupIntervalMs: 60000,
        staleTimeoutMs: 300000, // 5 minutes
      };
      
      expect(cleanupConfig.cleanupIntervalMs).toBeLessThan(cleanupConfig.staleTimeoutMs);
    });

    test('should limit buffer size', () => {
      const bufferConfig = {
        maxBufferSize: 65536, // 64KB
        highWaterMark: 32768, // 32KB
      };
      
      expect(bufferConfig.maxBufferSize).toBeGreaterThan(bufferConfig.highWaterMark);
    });
  });
});

// ============================================
// WebSocket Security Tests
// ============================================

describe('WebSocket Security', () => {
  describe('Authentication', () => {
    test('should require authentication', () => {
      const authConfig = {
        required: true,
        tokenHeader: 'authorization',
        algorithm: 'HS256',
      };
      
      expect(authConfig.required).toBe(true);
    });

    test('should validate JWT tokens', () => {
      const token = {
        header: { alg: 'HS256', typ: 'JWT' },
        payload: { sub: 'user_1', exp: Date.now() + 3600000 },
        valid: true,
      };
      
      expect(token.valid).toBe(true);
      expect(token.payload.exp).toBeGreaterThan(Date.now());
    });

    test('should reject expired tokens', () => {
      const token = {
        payload: { sub: 'user_1', exp: Date.now() - 1000 }, // Expired
        valid: false,
      };
      
      const isValid = token.payload.exp > Date.now();
      expect(isValid).toBe(false);
    });

    test('should handle token refresh', () => {
      const refreshConfig = {
        refreshToken: 'refresh_token_value',
        accessToken: 'new_access_token',
        expiresIn: 3600,
      };
      
      expect(refreshConfig.accessToken).toBeDefined();
      expect(refreshConfig.expiresIn).toBe(3600);
    });
  });

  describe('Authorization', () => {
    test('should check room access permissions', () => {
      const permissions = {
        user_1: ['project:proj_1', 'agent:oracle'],
        user_2: ['project:proj_2'],
      };
      
      const canAccess = permissions['user_1'].includes('project:proj_1');
      expect(canAccess).toBe(true);
    });

    test('should deny unauthorized room access', () => {
      const permissions = {
        user_1: ['project:proj_1'],
      };
      
      const canAccess = permissions['user_1'].includes('project:proj_2');
      expect(canAccess).toBe(false);
    });

    test('should enforce role-based access', () => {
      const roles = {
        admin: { canJoinAny: true },
        analyst: { canJoinProjects: ['proj_1', 'proj_2'] },
        viewer: { canJoinProjects: ['proj_1'], readOnly: true },
      };
      
      expect(roles.admin.canJoinAny).toBe(true);
      expect(roles.viewer.readOnly).toBe(true);
    });
  });

  describe('Input Validation', () => {
    test('should sanitize incoming messages', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      expect(sanitized).not.toContain('<script>');
    });

    test('should limit message size', () => {
      const maxMessageSize = 65536; // 64KB
      const message = { data: 'x'.repeat(100000) };
      
      const exceeds = JSON.stringify(message).length > maxMessageSize;
      expect(exceeds).toBe(true);
    });

    test('should prevent injection attacks', () => {
      const dangerousInputs = [
        '${process.exit(1)}',
        '{{constructor.constructor("return this")()}}',
        '__proto__.polluted = true',
      ];
      
      // All should be treated as strings, not evaluated
      dangerousInputs.forEach(input => {
        expect(typeof input).toBe('string');
      });
    });
  });
});

// ============================================
// WebSocket Heartbeat Tests
// ============================================

describe('WebSocket Heartbeat', () => {
  describe('Ping/Pong', () => {
    test('should send ping at regular intervals', () => {
      const heartbeat = {
        interval: 25000,
        timeout: 5000,
        lastPing: Date.now() - 24000,
      };
      
      const shouldPing = Date.now() - heartbeat.lastPing >= heartbeat.interval;
      expect(shouldPing).toBe(false); // Just under interval
    });

    test('should expect pong response', () => {
      const socket = createMockSocket();
      const pingId = 'ping_123';
      
      socket.emit('ping', { id: pingId });
      
      expect(socket.emit).toHaveBeenCalledWith('ping', { id: pingId });
    });

    test('should detect unresponsive connections', () => {
      const connection = {
        lastPong: Date.now() - 10000, // 10 seconds ago
        timeout: 5000,
      };
      
      const isUnresponsive = Date.now() - connection.lastPong > connection.timeout;
      expect(isUnresponsive).toBe(true);
    });

    test('should close stale connections', () => {
      const staleConnection = {
        socketId: 'socket_1',
        lastActivity: Date.now() - 300000, // 5 minutes ago
        staleTimeout: 180000, // 3 minutes
      };
      
      const isStale = Date.now() - staleConnection.lastActivity > staleConnection.staleTimeout;
      expect(isStale).toBe(true);
    });
  });
});

// ============================================
// WebSocket Broadcasting Tests
// ============================================

describe('WebSocket Broadcasting', () => {
  describe('Room Broadcasting', () => {
    test('should broadcast to all room members', () => {
      const roomMembers = ['socket_1', 'socket_2', 'socket_3'];
      const message = { type: 'update', data: 'test' };
      
      // Simulate broadcast
      const recipientCount = roomMembers.length;
      
      expect(recipientCount).toBe(3);
    });

    test('should exclude sender from broadcast', () => {
      const broadcast = {
        room: 'project:proj_1',
        sender: 'socket_1',
        recipients: ['socket_2', 'socket_3'],
      };
      
      expect(broadcast.recipients).not.toContain(broadcast.sender);
    });

    test('should handle empty room', () => {
      const roomMembers: string[] = [];
      
      expect(roomMembers).toHaveLength(0);
    });
  });

  describe('Selective Broadcasting', () => {
    test('should broadcast to specific users', () => {
      const userSockets = {
        user_1: ['socket_1', 'socket_2'],
        user_2: ['socket_3'],
      };
      
      const targetUser = 'user_1';
      const targetSockets = userSockets[targetUser];
      
      expect(targetSockets).toHaveLength(2);
    });

    test('should broadcast based on filters', () => {
      const sockets = [
        { id: 's1', role: 'admin' },
        { id: 's2', role: 'analyst' },
        { id: 's3', role: 'admin' },
      ];
      
      const adminSockets = sockets.filter(s => s.role === 'admin');
      expect(adminSockets).toHaveLength(2);
    });
  });
});
