import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all backlog issues for a class

export async function GET(req: NextRequest, { params }: { params: { classId: string } }) {
  const { classId } = params;
  try {
    // Find all projects for this class
    const projects = await prisma.project.findMany({
      where: { team: { classId } },
      select: { id: true },
    });
    const projectIds = projects.map(p => p.id);
    // Fetch backlog issues for all projects in this class (not assigned to any sprint)
    const issues = await prisma.gitHubIssue.findMany({
      where: {
        projectId: { in: projectIds },
        sprintId: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ issues });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch backlog issues.' }, { status: 500 });
  }
}

// POST: Create a new backlog issue for a class

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const { classId } = params;
  const data = await req.json();
  try {
    // Find the first project for this class (or require projectId in data)
    let projectId = data.projectId;
    if (!projectId) {
      const project = await prisma.project.findFirst({
        where: { team: { classId } },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'No project found for this class.' }, { status: 400 });
      }
      projectId = project.id;
    }
    const issue = await prisma.gitHubIssue.create({
      data: {
        ...data,
        projectId,
        sprintId: null, // Ensure it's a backlog issue
      },
    });
    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create backlog issue.' }, { status: 500 });
  }
}
