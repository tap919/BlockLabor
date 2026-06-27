/**
 * Sandbox API Routes
 * REST API for managing the financial sandbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { financialSandbox } from '@/sandbox/financial-sandbox';
import { executionBus, ApprovedVerb } from '@/sandbox/execution/execution-bus';
import { browserService } from '@/sandbox/browser/browser-service';
import { uploadService } from '@/sandbox/uploads/upload-service';

// ============================================
// Sandbox Status Endpoint
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'status':
      return NextResponse.json({
        environment: financialSandbox.getEnvironment(),
        mode: financialSandbox.getMode(),
        activePipelines: financialSandbox['pipelines'].size,
        activeDecisions: financialSandbox['decisions'].size,
        killSwitches: Array.from(financialSandbox['killSwitches'].entries()).map(([id, ks]) => ({
          id,
          scope: ks.scope,
          target: ks.target,
          enabled: ks.enabled,
          triggeredAt: ks.triggeredAt,
          reason: ks.reason,
        })),
      });

    case 'verbs':
      return NextResponse.json({
        verbs: executionBus.getApprovedVerbs(),
      });

    case 'browsers':
      return NextResponse.json({
        sessions: browserService.listSessions(),
      });

    case 'components':
      const components = await uploadService.listComponents();
      return NextResponse.json({ components });

    case 'logs':
      const limit = parseInt(searchParams.get('limit') || '100');
      return NextResponse.json({
        executionLogs: executionBus.getExecutionLogs(limit),
        requestLogs: executionBus.getRequestLogs(limit),
      });

    default:
      return NextResponse.json({
        message: 'Financial Sandbox API',
        endpoints: {
          'GET ?action=status': 'Get sandbox status',
          'GET ?action=verbs': 'Get approved verbs',
          'GET ?action=browsers': 'List browser sessions',
          'GET ?action=components': 'List uploaded components',
          'GET ?action=logs': 'Get execution logs',
          'POST ?action=execute': 'Execute an approved verb',
          'POST ?action=decision': 'Create a decision object',
          'POST ?action=browser': 'Create browser session',
          'POST ?action=upload': 'Upload component folder',
          'PUT ?action=mode': 'Set sandbox mode',
          'DELETE ?action=browser': 'Close browser session',
          'DELETE ?action=killswitch': 'Activate/deactivate kill switch',
        },
      });
  }
}

// ============================================
// POST Handlers
// ============================================

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'execute':
        return await handleExecute(request);

      case 'decision':
        return await handleDecision(request);

      case 'browser':
        return await handleBrowserCreate(request);

      case 'browser-action':
        return await handleBrowserAction(request);

      case 'upload':
        return await handleUpload(request);

      case 'pipeline':
        return await handlePipelineCreate(request);

      case 'pipeline-run':
        return await handlePipelineRun(request);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// PUT Handlers
// ============================================

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'mode':
        return await handleSetMode(request);

      case 'environment':
        return await handleSetEnvironment(request);

      case 'component':
        return await handleToggleComponent(request);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE Handlers
// ============================================

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'browser':
        const sessionId = searchParams.get('sessionId');
        if (!sessionId) {
          return NextResponse.json(
            { error: 'sessionId required' },
            { status: 400 }
          );
        }
        await browserService.closeSession(sessionId);
        return NextResponse.json({ success: true });

      case 'killswitch':
        return await handleKillSwitch(request);

      case 'component':
        const componentId = searchParams.get('id');
        if (!componentId) {
          return NextResponse.json(
            { error: 'id required' },
            { status: 400 }
          );
        }
        const deleted = await uploadService.deleteComponent(componentId);
        return NextResponse.json({ success: deleted });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// Handler Functions
// ============================================

async function handleExecute(request: NextRequest) {
  const body = await request.json();
  const { verb, target, payload, mode, decisionId, approvedBy } = body;

  if (!verb || !target) {
    return NextResponse.json(
      { error: 'verb and target are required' },
      { status: 400 }
    );
  }

  const result = await executionBus.execute({
    verb: verb as ApprovedVerb,
    target,
    payload: payload || {},
    mode: mode || financialSandbox.getMode(),
    decisionId: decisionId || 'direct',
    approvedBy,
  });

  return NextResponse.json(result);
}

async function handleDecision(request: NextRequest) {
  const body = await request.json();
  const { actionType, entity, reasoningSummary, evidenceRefs, executionPlan, rollbackPlan } = body;

  const decision = await financialSandbox.createDecision({
    actionType,
    entity,
    reasoningSummary,
    evidenceRefs: evidenceRefs || [],
    executionPlan,
    rollbackPlan,
  });

  return NextResponse.json(decision);
}

async function handleBrowserCreate(request: NextRequest) {
  const body = await request.json();
  const { mode, allowedDomains, restrictions, headless } = body;

  const session = await browserService.createSession({
    mode,
    allowedDomains,
    restrictions,
    headless: headless !== false,
  });

  return NextResponse.json({
    sessionId: session.id,
    mode: session.mode,
    createdAt: session.createdAt,
  });
}

async function handleBrowserAction(request: NextRequest) {
  const body = await request.json();
  const { sessionId, actions } = body;

  if (!sessionId || !actions) {
    return NextResponse.json(
      { error: 'sessionId and actions are required' },
      { status: 400 }
    );
  }

  if (Array.isArray(actions)) {
    const results = await browserService.executeWorkflow(sessionId, actions);
    return NextResponse.json({ results });
  } else {
    const result = await browserService.executeAction(sessionId, actions);
    return NextResponse.json(result);
  }
}

async function handleUpload(request: NextRequest) {
  // For Next.js App Router, we need to handle FormData
  const formData = await request.formData();
  const type = formData.get('type') as 'agent' | 'mcp' | 'cli' | 'skill' || 'agent';
  const files = formData.getAll('files') as File[];

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'No files provided' },
      { status: 400 }
    );
  }

  // Convert File objects to Express.Multer-like format
  const multerFiles = await Promise.all(
    files.map(async (file) => ({
      fieldname: 'files',
      originalname: file.name,
      encoding: '7bit',
      mimetype: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
      size: file.size,
    }))
  );

  const result = await uploadService.processFolderUpload(type, multerFiles as any);
  return NextResponse.json(result);
}

async function handlePipelineCreate(request: NextRequest) {
  const body = await request.json();
  const { name, family, triggers, steps, enabled } = body;

  const pipeline = financialSandbox.createPipeline({
    name,
    family,
    triggers,
    steps,
    enabled,
  });

  return NextResponse.json(pipeline);
}

async function handlePipelineRun(request: NextRequest) {
  const body = await request.json();
  const { pipelineId, input } = body;

  if (!pipelineId) {
    return NextResponse.json(
      { error: 'pipelineId is required' },
      { status: 400 }
    );
  }

  const results = await financialSandbox.runPipeline(pipelineId, input);
  return NextResponse.json({ results });
}

async function handleSetMode(request: NextRequest) {
  const body = await request.json();
  const { mode } = body;

  if (!['simulation', 'draft', 'live'].includes(mode)) {
    return NextResponse.json(
      { error: 'Invalid mode. Must be simulation, draft, or live' },
      { status: 400 }
    );
  }

  try {
    financialSandbox.setMode(mode);
    return NextResponse.json({ mode: financialSandbox.getMode() });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

async function handleSetEnvironment(request: NextRequest) {
  const body = await request.json();
  const { environment } = body;

  if (!['dev', 'staging', 'production'].includes(environment)) {
    return NextResponse.json(
      { error: 'Invalid environment. Must be dev, staging, or production' },
      { status: 400 }
    );
  }

  // This would switch environments
  return NextResponse.json({ environment });
}

async function handleToggleComponent(request: NextRequest) {
  const body = await request.json();
  const { id, enabled } = body;

  const component = await uploadService.toggleComponent(id, enabled);
  return NextResponse.json(component);
}

async function handleKillSwitch(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') as 'global' | 'pipeline' | 'agent' | 'entity';
  const target = searchParams.get('target');
  const reason = searchParams.get('reason');
  const activate = searchParams.get('activate') === 'true';

  if (!scope || !target) {
    return NextResponse.json(
      { error: 'scope and target are required' },
      { status: 400 }
    );
  }

  if (activate) {
    financialSandbox.activateKillSwitch(scope, target, reason || 'Manual activation');
  } else {
    financialSandbox.deactivateKillSwitch(scope, target);
  }

  return NextResponse.json({
    scope,
    target,
    active: activate,
  });
}
