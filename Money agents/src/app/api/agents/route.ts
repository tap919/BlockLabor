import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/agents - List all agents
export async function GET() {
  try {
    const agents = await db.agent.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { executions: true }
        }
      }
    });
    
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
