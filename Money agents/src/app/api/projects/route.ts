import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/projects - List all projects
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        phases: {
          orderBy: { order: 'asc' }
        },
        portfolio: {
          include: {
            positions: true,
            transactions: {
              orderBy: { executedAt: 'desc' },
              take: 10
            }
          }
        }
      }
    });
    
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, mode = 'simulation' } = body;
    
    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }
    
    // Create project
    const project = await db.project.create({
      data: {
        name,
        description,
        mode,
        status: 'draft'
        // createdBy is optional - leave it null for system-created projects
      }
    });
    
    // Create default phases
    const phases = [
      { name: 'research', displayName: 'Research', description: 'Market research and data gathering', order: 0 },
      { name: 'analysis', displayName: 'Analysis', description: 'Quantitative and qualitative analysis', order: 1 },
      { name: 'validation', displayName: 'Validation', description: 'Security and compliance validation', order: 2 },
      { name: 'synthesis', displayName: 'Synthesis', description: 'Strategic synthesis and recommendations', order: 3 },
      { name: 'execution', displayName: 'Execution', description: 'Action execution and monitoring', order: 4 }
    ];
    
    await db.phase.createMany({
      data: phases.map(phase => ({
        ...phase,
        projectId: project.id,
        status: 'pending'
      }))
    });
    
    // Create portfolio for simulation mode
    if (mode === 'simulation') {
      await db.portfolio.create({
        data: {
          projectId: project.id,
          cash: 100000,
          totalValue: 100000
        }
      });
    }
    
    // Fetch complete project
    const completeProject = await db.project.findUnique({
      where: { id: project.id },
      include: {
        phases: { orderBy: { order: 'asc' } },
        portfolio: true
      }
    });
    
    return NextResponse.json(completeProject);
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
