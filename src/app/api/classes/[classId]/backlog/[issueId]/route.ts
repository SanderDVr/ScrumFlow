import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getValidGitHubToken } from '@/lib/github';
import { Octokit } from '@octokit/rest';

// PATCH: Update a backlog issue
export async function PATCH(req: NextRequest, context: { params: { classId: string, issueId: string } } | { params: Promise<{ classId: string, issueId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Support both sync and async params (Next.js app router)
  let params = (context.params as any);
  if (typeof params.then === 'function') {
    params = await params;
  }
  const { classId, issueId } = params;
  
  const data = await req.json();
  const { title, body } = data;

  try {
    // Get the issue with project info
    const issue = await prisma.gitHubIssue.findUnique({
      where: { id: issueId },
      include: {
        project: {
          select: {
            id: true,
            repositoryOwner: true,
            repositoryName: true,
            team: {
              select: { classId: true }
            }
          },
        },
      },
    });

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    }

    // Verify the issue belongs to the correct class
    if (issue.project.team?.classId !== classId) {
      return NextResponse.json({ error: 'Issue does not belong to this class.' }, { status: 403 });
    }

    // Update on GitHub if repository is configured
    if (issue.project.repositoryOwner && issue.project.repositoryName) {
      const accessToken = await getValidGitHubToken(session.user.id);
      
      if (accessToken) {
        const octokit = new Octokit({ auth: accessToken });
        
        try {
          await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
            owner: issue.project.repositoryOwner,
            repo: issue.project.repositoryName,
            issue_number: issue.issueNumber,
            title: title || issue.title,
            body: body !== undefined ? body : issue.body,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
          });
        } catch (githubError: any) {
          console.error('Error updating GitHub issue:', githubError.message);
          // Continue to update locally even if GitHub update fails
          if (githubError.status === 401 || githubError.status === 403) {
            // Update locally but warn user
            const updated = await prisma.gitHubIssue.update({
              where: { id: issueId },
              data: { title, body },
            });
            return NextResponse.json({ 
              ...updated,
              warning: 'Issue bijgewerkt in de app, maar kon niet worden bijgewerkt op GitHub. Controleer je rechten.' 
            });
          }
        }
      }
    }

    // Update in database
    const updated = await prisma.gitHubIssue.update({
      where: { id: issueId },
      data: { title, body },
    });
    
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Failed to update backlog issue:', error);
    return NextResponse.json({ error: 'Failed to update backlog issue.', details: error?.message }, { status: 500 });
  }
}

// DELETE: Delete a backlog issue from both GitHub and database
export async function DELETE(req: NextRequest, context: { params: { classId: string, issueId: string } } | { params: Promise<{ classId: string, issueId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
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
    
    // Get the issue with project info
    const issue = await prisma.gitHubIssue.findUnique({
      where: { id: issueId },
      include: {
        project: {
          select: {
            repositoryOwner: true,
            repositoryName: true,
          },
        },
      },
    });
    
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    }
    
    console.log('=== DELETE ISSUE DEBUG ===');
    console.log('Issue ID:', issueId);
    console.log('Issue Number:', issue.issueNumber);
    console.log('Repository Owner:', issue.project.repositoryOwner);
    console.log('Repository Name:', issue.project.repositoryName);
    console.log('User ID:', session.user.id);
    
    // Delete from GitHub if repository is configured
    if (issue.project.repositoryOwner && issue.project.repositoryName) {
      console.log(`Attempting to close GitHub issue #${issue.issueNumber} in ${issue.project.repositoryOwner}/${issue.project.repositoryName}`);
      
      // Get a valid GitHub token (will auto-refresh if expired)
      const accessToken = await getValidGitHubToken(session.user.id);
      
      console.log(`Valid access token available: ${accessToken ? 'yes (first 10 chars: ' + accessToken.substring(0, 10) + '...)' : 'no'}`);
      
      if (accessToken) {
        console.log(`Closing issue #${issue.issueNumber} using Octokit`);
        
        // Use Octokit to close the issue
        const octokit = new Octokit({
          auth: accessToken,
        });
        
        try {
          const response = await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
            owner: issue.project.repositoryOwner,
            repo: issue.project.repositoryName,
            issue_number: issue.issueNumber,
            state: 'closed',
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
          });
          
          console.log('Successfully closed GitHub issue:', response.data.state);
        } catch (githubError: any) {
          console.error('Error closing GitHub issue:', githubError.message);
          console.error('GitHub error status:', githubError.status);
          
          if (githubError.status === 401) {
            // Token is invalid/expired even after refresh - still delete locally but inform user
            await prisma.gitHubIssue.update({
              where: { id: issueId },
              data: { sprintId: null },
            });
            await prisma.gitHubIssue.delete({
              where: { id: issueId },
            });
            return NextResponse.json({ 
              success: true, 
              warning: 'Issue verwijderd uit de app, maar kon niet gesloten worden op GitHub. Je GitHub authenticatie is verlopen. Log opnieuw in.' 
            });
          } else if (githubError.status === 403) {
            await prisma.gitHubIssue.update({
              where: { id: issueId },
              data: { sprintId: null },
            });
            await prisma.gitHubIssue.delete({
              where: { id: issueId },
            });
            return NextResponse.json({ 
              success: true, 
              warning: 'Issue verwijderd uit de app, maar kon niet gesloten worden op GitHub. Je hebt geen schrijfrechten op deze repository.' 
            });
          } else if (githubError.status === 404) {
            // Issue doesn't exist on GitHub anymore, just delete locally
            console.log('Issue not found on GitHub, deleting locally only');
          } else {
            await prisma.gitHubIssue.update({
              where: { id: issueId },
              data: { sprintId: null },
            });
            await prisma.gitHubIssue.delete({
              where: { id: issueId },
            });
            return NextResponse.json({ 
              success: true, 
              warning: `Issue verwijderd uit de app, maar kon niet gesloten worden op GitHub. Error: ${githubError.message || 'Onbekende fout'}` 
            });
          }
        }
      } else {
        console.log('No valid GitHub access token available, skipping GitHub close');
        // Delete locally and warn the user
        await prisma.gitHubIssue.update({
          where: { id: issueId },
          data: { sprintId: null },
        });
        await prisma.gitHubIssue.delete({
          where: { id: issueId },
        });
        return NextResponse.json({ 
          success: true, 
          warning: 'Issue verwijderd uit de app, maar kon niet gesloten worden op GitHub. Geen geldige GitHub token beschikbaar. Log opnieuw in.' 
        });
      }
    } else {
      console.log('No repository configured, skipping GitHub close');
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
  } catch (error: any) {
    console.error('Failed to delete backlog issue:', error);
    return NextResponse.json({ error: 'Failed to delete backlog issue.', details: error?.message || error }, { status: 500 });
  }
}
