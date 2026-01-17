import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getValidGitHubToken } from '@/lib/github';

// GET: Fetch all backlog issues for a class and optionally sync from GitHub

export async function GET(req: NextRequest, context: { params: { classId: string } } | { params: Promise<{ classId: string }> }) {
  let params = (context.params as any);
  if (typeof params.then === 'function') {
    params = await params;
  }
  const { classId } = params;
  
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check if sync is requested
  const url = new URL(req.url);
  const shouldSync = url.searchParams.get('sync') === 'true';
  
  try {
    const projects = await prisma.project.findMany({
      where: { team: { classId } },
      select: { id: true, repositoryOwner: true, repositoryName: true },
    });
    const projectIds = projects.map(p => p.id);
    
    let syncError = null;
    
    // Sync from GitHub if requested
    if (shouldSync) {
      for (const project of projects) {
        if (project.repositoryOwner && project.repositoryName) {
          try {
            const repoUrl = `https://api.github.com/repos/${project.repositoryOwner}/${project.repositoryName}/issues?state=open`;
            
            // Get valid GitHub access token (will auto-refresh if expired)
            const accessToken = await getValidGitHubToken(session.user.id);
            
            let githubResponse;
            if (accessToken) {
              githubResponse = await fetch(repoUrl, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              });
              
              if (!githubResponse.ok && githubResponse.status === 401) {
                githubResponse = await fetch(repoUrl, {
                  headers: {
                    Accept: 'application/vnd.github.v3+json',
                  },
                });
              }
            } else {
              githubResponse = await fetch(repoUrl, {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                },
              });
            }
            
            if (githubResponse.ok) {
              const githubIssues = await githubResponse.json();
              
              // Sync issues to database
              for (const issue of githubIssues) {
                if (issue.pull_request) continue;
                
                await prisma.gitHubIssue.upsert({
                  where: {
                    projectId_issueNumber: {
                      projectId: project.id,
                      issueNumber: issue.number,
                    },
                  },
                  update: {
                    title: issue.title,
                    body: issue.body || null,
                    state: issue.state,
                    htmlUrl: issue.html_url,
                    labels: JSON.stringify(issue.labels),
                    assignees: JSON.stringify(issue.assignees),
                    githubUpdatedAt: new Date(issue.updated_at),
                  },
                  create: {
                    projectId: project.id,
                    sprintId: null,
                    issueNumber: issue.number,
                    title: issue.title,
                    body: issue.body || null,
                    state: issue.state,
                    htmlUrl: issue.html_url,
                    status: 'todo',
                    labels: JSON.stringify(issue.labels),
                    assignees: JSON.stringify(issue.assignees),
                    githubCreatedAt: new Date(issue.created_at),
                    githubUpdatedAt: new Date(issue.updated_at),
                  },
                });
              }
            } else {
              console.error(`GitHub API error: ${githubResponse.status}`);
              syncError = `GitHub API returned status ${githubResponse.status}`;
            }
          } catch (fetchError: any) {
            console.error('GitHub sync error:', fetchError);
            syncError = fetchError.cause?.code === 'ENOTFOUND' 
              ? 'Cannot reach GitHub API. Check your internet connection.' 
              : 'Failed to sync from GitHub';
          }
        }
      }
    }
    
    const issues = await prisma.gitHubIssue.findMany({
      where: {
        projectId: { in: projectIds },
        sprintId: null,
        state: 'open',
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Fetch sprints if requested
    let sprints: any[] = [];
    const includeSprints = url.searchParams.get('includeSprints') === 'true';
    if (includeSprints) {
      sprints = await prisma.sprint.findMany({
        where: {
          project: {
            team: { classId }
          },
          status: { not: 'completed' }
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: 'asc' },
      });
    }
    
    return NextResponse.json({ issues, projects, sprints, syncError });
  } catch (error) {
    console.error('Error in GET backlog', error);
    return NextResponse.json({ error: 'Failed to fetch backlog issues.' }, { status: 500 });
  }
}

// POST: Create a new backlog issue for a class

export async function POST(req: NextRequest, context: { params: { classId: string } } | { params: Promise<{ classId: string }> }) {
  let params = (context.params as any);
  if (typeof params.then === 'function') {
    params = await params;
  }
  const { classId } = params;
  const data = await req.json();
  try {
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
    
    // Get the highest issue number for this project to generate a local issue number
    const lastIssue = await prisma.gitHubIssue.findFirst({
      where: { projectId },
      orderBy: { issueNumber: 'desc' },
      select: { issueNumber: true },
    });
    const nextIssueNumber = (lastIssue?.issueNumber || 0) + 1;
    
    const now = new Date();
    const issue = await prisma.gitHubIssue.create({
      data: {
        projectId,
        sprintId: null,
        issueNumber: nextIssueNumber,
        title: data.title,
        body: data.body || null,
        state: 'open',
        htmlUrl: '', // Local issue, no GitHub URL
        status: 'todo',
        githubCreatedAt: now,
        githubUpdatedAt: now,
      },
    });
    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    console.error('Error creating backlog issue:', error);
    return NextResponse.json({ error: 'Failed to create backlog issue.' }, { status: 500 });
  }
}
