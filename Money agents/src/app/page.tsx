'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useAgentSocket } from '@/hooks/use-agent-socket';
import { 
  Plus, Play, Pause, Trash2, RefreshCw, Activity, Zap, Shield, CheckCircle, 
  XCircle, AlertTriangle, Clock, TrendingUp, TrendingDown, DollarSign,
  Radar, Calculator, Sparkles, BookOpen, BarChart3, Users, Settings,
  ChevronRight, Eye, FileText, MessageSquare, AlertCircle
} from 'lucide-react';

// Types
interface Agent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
}

interface Phase {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  order: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  outputs?: { agentName: string; content: string }[];
}

interface Execution {
  id: string;
  agentName: string;
  status: string;
  output: string | null;
  error: string | null;
  duration: number | null;
  startedAt: string | null;
  completedAt: string | null;
  agent?: { displayName: string; color: string };
}

interface Approval {
  id: string;
  projectId: string;
  requester: string;
  action: string;
  context: string;
  status: string;
  createdAt: string;
  project?: { name: string };
}

interface Portfolio {
  cash: number;
  totalValue: number;
  dayPnL: number;
  totalPnL: number;
  positions: { symbol: string; quantity: number; unrealizedPnL: number }[];
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  mode: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  phases: Phase[];
  executions: Execution[];
  portfolio: Portfolio | null;
  approvals: Approval[];
}

// Agent icons mapping
const AGENT_ICONS: Record<string, React.ReactNode> = {
  sentinel: <Radar className="h-4 w-4" />,
  cipher: <Calculator className="h-4 w-4" />,
  guardian: <Shield className="h-4 w-4" />,
  oracle: <Sparkles className="h-4 w-4" />,
  vector: <TrendingUp className="h-4 w-4" />,
  ledger: <BookOpen className="h-4 w-4" />
};

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  running: 'bg-blue-500 animate-pulse',
  paused: 'bg-yellow-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  pending: 'bg-gray-400',
  completed_phase: 'bg-green-500'
};

const ERV_COLORS: Record<string, string> = {
  execute: 'bg-green-500',
  refuse: 'bg-red-500',
  verify: 'bg-yellow-500'
};

export default function AgentSandboxDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [apiAgents, setApiAgents] = useState<Agent[]>([]);
  const [liveActivity, setLiveActivity] = useState<{ type: string; message: string; timestamp: Date }[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectMode, setNewProjectMode] = useState('simulation');

  // WebSocket connection
  const {
    isConnected,
    agents: wsAgents,
    createProject,
    startProject,
    requestProjects,
    respondToApproval
  } = useAgentSocket({
    onProjectsList: (data) => setProjects(data as Project[]),
    onProjectCreated: (data) => {
      setProjects(prev => [data.project as Project, ...prev]);
      setIsCreateDialogOpen(false);
      addActivity('project', `Project "${(data.project as Project).name}" created`);
    },
    onProjectStarted: (data) => {
      addActivity('project', `Project started: ${data.projectId}`);
      refreshProjects();
    },
    onProjectCompleted: (data) => {
      addActivity('project', `Project completed: ${data.projectId}`);
      refreshProjects();
    },
    onPhaseStarted: (data) => {
      addActivity('phase', `Phase "${data.phaseName}" started`);
    },
    onPhaseCompleted: (data) => {
      addActivity('phase', `Phase "${data.phaseName}" completed`);
    },
    onAgentStarted: (data) => {
      addActivity('agent', `Agent "${data.agentName}" started execution`);
    },
    onAgentCompleted: (data) => {
      addActivity('agent', `Agent "${data.agentName}" completed (${data.duration}ms) - ERV: ${data.ervDecision}`);
    },
    onApprovalRequired: (data) => {
      addActivity('approval', `Approval required for: ${data.action}`);
    }
  });

  // Fetch initial data
  const refreshProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Derive agents from WebSocket, fallback to API agents
  const agents = useMemo(() => {
    if (wsAgents && Array.isArray(wsAgents) && wsAgents.length > 0) {
      return wsAgents as Agent[];
    }
    return apiAgents;
  }, [wsAgents, apiAgents]);

  // Fetch agents from API as fallback
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        const data = await response.json();
        if (data && data.length > 0) {
          setApiAgents(data);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      }
    };
    fetchAgents();
  }, []);

  const addActivity = (type: string, message: string) => {
    setLiveActivity(prev => [
      { type, message, timestamp: new Date() },
      ...prev.slice(0, 49)
    ]);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription,
          mode: newProjectMode
        })
      });
      
      if (response.ok) {
        const project = await response.json();
        setProjects(prev => [project, ...prev]);
        setIsCreateDialogOpen(false);
        setNewProjectName('');
        setNewProjectDescription('');
        addActivity('project', `Project "${project.name}" created`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleStartProject = async (projectId: string) => {
    startProject(projectId);
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleApproval = async (approvalId: string, approved: boolean, notes?: string) => {
    try {
      await fetch('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, approved, notes })
      });
      addActivity('approval', `Approval ${approved ? 'granted' : 'denied'}`);
      refreshProjects();
    } catch (error) {
      console.error('Failed to respond to approval:', error);
    }
  };

  const selectProject = async (project: Project) => {
    try {
      const response = await fetch(`/api/projects/${project.id}`);
      const data = await response.json();
      setSelectedProject(data);
    } catch (error) {
      console.error('Failed to fetch project details:', error);
      setSelectedProject(project);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running': return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-gray-400" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPhaseProgress = (phases: Phase[]) => {
    if (!phases || phases.length === 0) return 0;
    const completed = phases.filter(p => p.status === 'completed').length;
    return Math.round((completed / phases.length) * 100);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatTime = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Autonomous Agent Sandbox</h1>
              </div>
              <Badge variant={isConnected ? 'default' : 'destructive'} className="gap-1">
                <Activity className={`h-3 w-3 ${isConnected ? 'animate-pulse' : ''}`} />
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refreshProjects}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Start a new autonomous agent project with multiple phases
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Enter project name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        placeholder="Project description (optional)"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mode">Mode</Label>
                      <Select value={newProjectMode} onValueChange={setNewProjectMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simulation">Simulation (Paper Trading)</SelectItem>
                          <SelectItem value="live">Live (Real Data)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
                      Create Project
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Projects List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Agent Overview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Available Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex flex-col items-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      title={agent.description}
                    >
                      <div className={`${agent.color || 'text-gray-500'}`}>
                        {AGENT_ICONS[agent.name] || <Activity className="h-4 w-4" />}
                      </div>
                      <span className="text-xs mt-1 text-center">{agent.displayName}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Projects List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Projects
                  </span>
                  <Badge variant="outline">{projects.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y">
                    {projects.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No projects yet. Create one to get started.
                      </div>
                    ) : (
                      projects.map((project) => (
                        <div
                          key={project.id}
                          className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedProject?.id === project.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => selectProject(project)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-medium text-sm">{project.name}</h3>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {project.description || 'No description'}
                              </p>
                            </div>
                            <Badge className={`${STATUS_COLORS[project.status]} text-white text-xs`}>
                              {project.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={getPhaseProgress(project.phases)} className="h-1 flex-1" />
                            <span className="text-xs text-muted-foreground">
                              {getPhaseProgress(project.phases)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {project.mode === 'simulation' ? '📊 Simulation' : '🔴 Live'}
                            </Badge>
                            {project.portfolio && (
                              <span className="text-green-600">
                                {formatCurrency(project.portfolio.totalValue)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Middle Panel - Selected Project Details */}
          <div className="lg:col-span-2 space-y-4">
            {selectedProject ? (
              <>
                {/* Project Header */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{selectedProject.name}</CardTitle>
                        <CardDescription>{selectedProject.description || 'No description provided'}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${STATUS_COLORS[selectedProject.status]} text-white`}>
                          {selectedProject.status}
                        </Badge>
                        <Badge variant="outline">
                          {selectedProject.mode === 'simulation' ? '📊 Simulation' : '🔴 Live'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {selectedProject.status === 'draft' && (
                        <Button onClick={() => handleStartProject(selectedProject.id)} size="sm">
                          <Play className="h-4 w-4 mr-2" />
                          Start Project
                        </Button>
                      )}
                      {selectedProject.status === 'running' && (
                        <Button variant="outline" size="sm" disabled>
                          <Activity className="h-4 w-4 mr-2 animate-pulse" />
                          Running...
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProject(selectedProject.id)}
                        disabled={selectedProject.status === 'running'}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabs for different views */}
                <Tabs defaultValue="phases" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="phases">Phases</TabsTrigger>
                    <TabsTrigger value="agents">Agents</TabsTrigger>
                    <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                    <TabsTrigger value="approvals">Approvals</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>

                  {/* Phases Tab */}
                  <TabsContent value="phases" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Phase Progress</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {selectedProject.phases?.map((phase, index) => (
                            <div key={phase.id} className="flex items-start gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  phase.status === 'completed' ? 'bg-green-500 text-white' :
                                  phase.status === 'running' ? 'bg-blue-500 text-white animate-pulse' :
                                  phase.status === 'failed' ? 'bg-red-500 text-white' :
                                  'bg-gray-200 dark:bg-gray-700'
                                }`}>
                                  {phase.status === 'completed' ? <CheckCircle className="h-4 w-4" /> :
                                   phase.status === 'running' ? <Activity className="h-4 w-4" /> :
                                   index + 1}
                                </div>
                                {index < selectedProject.phases.length - 1 && (
                                  <div className={`w-0.5 h-8 my-1 ${
                                    phase.status === 'completed' ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                                  }`} />
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-medium text-sm">{phase.displayName}</h4>
                                  {getStatusIcon(phase.status)}
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">{phase.description}</p>
                                {phase.outputs && phase.outputs.length > 0 && (
                                  <div className="bg-muted/50 rounded p-2 text-xs">
                                    {phase.outputs.map((output, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {output.agentName}
                                        </Badge>
                                        <span className="text-muted-foreground truncate">
                                          {output.content.substring(0, 50)}...
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Agents Tab */}
                  <TabsContent value="agents" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Agent Executions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {selectedProject.executions?.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                No agent executions yet
                              </p>
                            ) : (
                              selectedProject.executions?.map((execution) => (
                                <div key={execution.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                  <div className={execution.agent?.color || 'text-gray-500'}>
                                    {AGENT_ICONS[execution.agentName] || <Activity className="h-4 w-4" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{execution.agent?.displayName || execution.agentName}</span>
                                      <Badge className={`${STATUS_COLORS[execution.status]} text-white text-xs`}>
                                        {execution.status}
                                      </Badge>
                                    </div>
                                    {execution.output && (
                                      <p className="text-xs text-muted-foreground truncate mt-1">
                                        {execution.output.substring(0, 100)}...
                                      </p>
                                    )}
                                    {execution.error && (
                                      <p className="text-xs text-red-500 truncate mt-1">
                                        {execution.error}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right text-xs text-muted-foreground">
                                    {execution.duration && <div>{execution.duration}ms</div>}
                                    {execution.tokensUsed && <div>{execution.tokensUsed} tokens</div>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Portfolio Tab */}
                  <TabsContent value="portfolio" className="mt-4">
                    {selectedProject.mode === 'simulation' && selectedProject.portfolio ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Portfolio Value
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {formatCurrency(selectedProject.portfolio.totalValue)}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-sm ${selectedProject.portfolio.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {selectedProject.portfolio.totalPnL >= 0 ? '+' : ''}
                                {formatCurrency(selectedProject.portfolio.totalPnL)}
                              </span>
                              <Badge variant={selectedProject.portfolio.totalPnL >= 0 ? 'default' : 'destructive'} className="text-xs">
                                {selectedProject.portfolio.totalPnL >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                                {((selectedProject.portfolio.totalPnL / 100000) * 100).toFixed(2)}%
                              </Badge>
                            </div>
                            <Separator className="my-4" />
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Cash</p>
                                <p className="font-medium">{formatCurrency(selectedProject.portfolio.cash)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Day P&L</p>
                                <p className={`font-medium ${selectedProject.portfolio.dayPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {formatCurrency(selectedProject.portfolio.dayPnL)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              Risk Metrics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                                <span className="font-medium">
                                  {selectedProject.portfolio.sharpeRatio?.toFixed(2) || '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">VaR (95%)</span>
                                <span className="font-medium">
                                  {selectedProject.portfolio.var95 ? formatCurrency(selectedProject.portfolio.var95) : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Max Drawdown</span>
                                <span className="font-medium text-red-500">
                                  {selectedProject.portfolio.maxDrawdown ? `${(selectedProject.portfolio.maxDrawdown * 100).toFixed(2)}%` : '-'}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Positions</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {selectedProject.portfolio.positions?.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                No positions yet
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left py-2">Symbol</th>
                                      <th className="text-right py-2">Quantity</th>
                                      <th className="text-right py-2">Unrealized P&L</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedProject.portfolio.positions?.map((position) => (
                                      <tr key={position.symbol} className="border-b">
                                        <td className="py-2 font-medium">{position.symbol}</td>
                                        <td className="text-right py-2">{position.quantity}</td>
                                        <td className={`text-right py-2 ${position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                          {formatCurrency(position.unrealizedPnL || 0)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          Portfolio tracking is only available in simulation mode
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Approvals Tab */}
                  <TabsContent value="approvals" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Pending Approvals
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedProject.approvals?.length === 0 ? (
                          <div className="text-center text-muted-foreground py-8">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            <p>No pending approvals</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {selectedProject.approvals?.map((approval) => (
                              <Alert key={approval.id} className="border-yellow-500">
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                <AlertTitle className="flex items-center gap-2">
                                  Approval Required
                                  <Badge variant="outline" className="text-xs">{approval.requester}</Badge>
                                </AlertTitle>
                                <AlertDescription className="mt-2">
                                  <p className="text-sm mb-2">{approval.action}</p>
                                  <div className="bg-muted/50 rounded p-2 text-xs mb-3">
                                    {approval.context}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="bg-green-500 text-white hover:bg-green-600"
                                      onClick={() => handleApproval(approval.id, true)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="bg-red-500 text-white hover:bg-red-600"
                                      onClick={() => handleApproval(approval.id, false)}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                  </div>
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Activity Tab */}
                  <TabsContent value="activity" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Live Activity Feed
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {liveActivity.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                No activity yet
                              </p>
                            ) : (
                              liveActivity.map((activity, index) => (
                                <div key={index} className="flex items-center gap-3 p-2 rounded bg-muted/50 text-sm">
                                  <div className={`w-2 h-2 rounded-full ${
                                    activity.type === 'agent' ? 'bg-blue-500' :
                                    activity.type === 'phase' ? 'bg-purple-500' :
                                    activity.type === 'project' ? 'bg-green-500' :
                                    activity.type === 'approval' ? 'bg-yellow-500' :
                                    'bg-gray-400'
                                  }`} />
                                  <span className="flex-1">{activity.message}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {activity.timestamp.toLocaleTimeString()}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <Card className="flex items-center justify-center h-[500px]">
                <CardContent className="text-center">
                  <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Select a Project</h3>
                  <p className="text-muted-foreground">
                    Choose a project from the list to view details and manage agents
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Bottom Panel - Live Activity Stream */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className={`h-4 w-4 ${isConnected ? 'animate-pulse' : ''}`} />
              System Activity Stream
              <Badge variant={isConnected ? 'default' : 'destructive'} className="ml-2">
                {isConnected ? 'Live' : 'Offline'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[120px]">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {liveActivity.slice(0, 20).map((activity, index) => (
                  <div key={index} className="flex-shrink-0 px-3 py-2 bg-muted rounded-lg text-xs">
                    <span className="font-medium capitalize">{activity.type}:</span>{' '}
                    {activity.message}
                  </div>
                ))}
                {liveActivity.length === 0 && (
                  <div className="text-muted-foreground text-sm">
                    Waiting for activity...
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>
              <strong>Simulation Only:</strong> This is a sandbox environment for autonomous agent testing. 
              No real money is involved. All trades and transactions are simulated.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
