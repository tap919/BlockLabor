'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseAgentSocketOptions {
  onProjectCreated?: (data: { project: unknown }) => void;
  onProjectStarted?: (data: { projectId: string; phases: unknown[] }) => void;
  onProjectCompleted?: (data: { projectId: string }) => void;
  onProjectsList?: (projects: unknown[]) => void;
  onPhaseStarted?: (data: { projectId: string; phaseId: string; phaseName: string }) => void;
  onPhaseCompleted?: (data: { projectId: string; phaseId: string; phaseName: string }) => void;
  onPhaseFailed?: (data: { projectId: string; phaseId: string; error: string }) => void;
  onAgentStarted?: (data: { projectId: string; phaseId: string; agentName: string; executionId: string }) => void;
  onAgentCompleted?: (data: { projectId: string; phaseId: string; agentName: string; executionId: string; output: string; ervDecision: string; duration: number }) => void;
  onAgentFailed?: (data: { projectId: string; phaseId: string; agentName: string; executionId: string; error: string }) => void;
  onApprovalRequired?: (data: { projectId: string; agentName: string; action: string; reasoning: string }) => void;
  onApprovalResolved?: (data: { approval: unknown; approved: boolean }) => void;
  onError?: (data: { message: string; error: string }) => void;
}

export function useAgentSocket(options: UseAgentSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [agents, setAgents] = useState<unknown[]>([]);

  useEffect(() => {
    // Connect to WebSocket server via Caddy gateway
    // Use relative path with XTransformPort query parameter for gateway routing
    const socketUrl = window.location.origin;
    
    socketRef.current = io(socketUrl, {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      query: {
        XTransformPort: '3003'
      }
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('[WS] Connected to agent service');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected from agent service');
      setIsConnected(false);
    });

    // Agent definitions
    socket.on('agents:definitions', (data) => {
      setAgents(data);
    });

    // Project events
    socket.on('project:created', (data) => options.onProjectCreated?.(data));
    socket.on('project:started', (data) => options.onProjectStarted?.(data));
    socket.on('project:completed', (data) => options.onProjectCompleted?.(data));
    socket.on('projects:list', (data) => options.onProjectsList?.(data));

    // Phase events
    socket.on('phase:started', (data) => options.onPhaseStarted?.(data));
    socket.on('phase:completed', (data) => options.onPhaseCompleted?.(data));
    socket.on('phase:failed', (data) => options.onPhaseFailed?.(data));

    // Agent events
    socket.on('agent:started', (data) => options.onAgentStarted?.(data));
    socket.on('agent:completed', (data) => options.onAgentCompleted?.(data));
    socket.on('agent:failed', (data) => options.onAgentFailed?.(data));

    // Approval events
    socket.on('approval:required', (data) => options.onApprovalRequired?.(data));
    socket.on('approval:resolved', (data) => options.onApprovalResolved?.(data));

    // Error handling
    socket.on('error', (data) => options.onError?.(data));

    return () => {
      socket.disconnect();
    };
  }, []);

  const createProject = useCallback((name: string, description?: string, mode?: string) => {
    socketRef.current?.emit('project:create', { name, description, mode });
  }, []);

  const startProject = useCallback((projectId: string) => {
    socketRef.current?.emit('project:start', projectId);
  }, []);

  const requestProjects = useCallback(() => {
    socketRef.current?.emit('projects:list');
  }, []);

  const requestProjectDetails = useCallback((projectId: string) => {
    socketRef.current?.emit('project:details', projectId);
  }, []);

  const respondToApproval = useCallback((approvalId: string, approved: boolean, notes?: string) => {
    socketRef.current?.emit('approval:respond', { approvalId, approved, notes });
  }, []);

  return {
    isConnected,
    agents,
    createProject,
    startProject,
    requestProjects,
    requestProjectDetails,
    respondToApproval
  };
}
