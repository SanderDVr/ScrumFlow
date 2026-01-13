import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH: Update a backlog issue
export async function PATCH(req: NextRequest, { params }: { params: { classId: string, issueId: string } }) {
  const { classId, issueId } = params;
  const data = await req.json();
  try {
    // Find the projectId for this issue and class
    const project = await prisma.project.findFirst({
      where: { team: { classId } },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'No project found for this class.' }, { status: 400 });
    }
    const updated = await prisma.gitHubIssue.update({
      where: { id: issueId, projectId: project.id, sprintId: null },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update backlog issue.' }, { status: 500 });
  }
}

// DELETE: Delete a backlog issue
export async function DELETE(req: NextRequest, context: { params: { classId: string, issueId: string } } | { params: Promise<{ classId: string, issueId: string }> }) {
  // Support both sync and async params (Next.js app router)
  let params = (context.params as any);
  if (typeof params.then === 'function') {
    params = await params;
  }
  const { issueId } = params;
  try {
    if (!issueId) {
      return NextResponse.json({ error: 'No issueId provided.' }, { status: 400 });
    }
    // Remove from sprint if present (setNull), then delete the issue
    await prisma.gitHubIssue.update({
      where: { id: issueId },
      data: { sprintId: null },
    });
    await prisma.gitHubIssue.delete({
      where: { id: issueId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete backlog issue:', error);
    return NextResponse.json({ error: 'Failed to delete backlog issue.', details: error?.message || error }, { status: 500 });
  }
}
