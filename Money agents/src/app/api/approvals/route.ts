import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/approvals - List pending approvals
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    
    const where = projectId 
      ? { projectId, status: 'pending' }
      : { status: 'pending' };
    
    const approvals = await db.humanApproval.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { name: true }
        },
        ervDecision: {
          include: {
            phaseOutput: true
          }
        }
      }
    });
    
    return NextResponse.json(approvals);
  } catch (error) {
    console.error('Failed to fetch approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

// PATCH /api/approvals - Respond to an approval
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { approvalId, approved, notes } = body;
    
    if (!approvalId) {
      return NextResponse.json(
        { error: 'Approval ID is required' },
        { status: 400 }
      );
    }
    
    const approval = await db.humanApproval.update({
      where: { id: approvalId },
      data: {
        status: approved ? 'approved' : 'rejected',
        reviewedAt: new Date(),
        reviewNotes: notes
      }
    });
    
    // Update ERV decision
    await db.eRVDecision.update({
      where: { id: approval.ervDecisionId },
      data: {
        overridden: true,
        overriddenAt: new Date()
      }
    });
    
    return NextResponse.json(approval);
  } catch (error) {
    console.error('Failed to update approval:', error);
    return NextResponse.json(
      { error: 'Failed to update approval' },
      { status: 500 }
    );
  }
}
