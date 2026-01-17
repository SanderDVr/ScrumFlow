import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { Octokit } from '@octokit/rest';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  // Get the GitHub account
  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: 'github',
    },
  });

  if (!account?.access_token) {
    return NextResponse.json({ error: 'No GitHub token found' }, { status: 400 });
  }

  const octokit = new Octokit({
    auth: account.access_token,
  });

  try {
    // Check authenticated user
    const { data: user } = await octokit.request('GET /user', {
      headers: { 'X-GitHub-Api-Version': '2022-11-28' }
    });

    // Check token scopes from response headers
    const tokenInfo = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    
    const scopes = tokenInfo.headers.get('x-oauth-scopes');
    
    // Get repos to check access
    const { data: repos } = await octokit.request('GET /user/repos', {
      per_page: 10,
      sort: 'updated',
      headers: { 'X-GitHub-Api-Version': '2022-11-28' }
    });

    // Get projects from database to check repository access
    const projects = await prisma.project.findMany({
      where: {
        repositoryOwner: { not: null },
        repositoryName: { not: null },
      },
      select: {
        id: true,
        repositoryOwner: true,
        repositoryName: true,
      },
    });

    // Check permissions for each project repository
    const repoPermissions = await Promise.all(
      projects.map(async (project) => {
        try {
          const { data: repo } = await octokit.request('GET /repos/{owner}/{repo}', {
            owner: project.repositoryOwner!,
            repo: project.repositoryName!,
            headers: { 'X-GitHub-Api-Version': '2022-11-28' }
          });
          
          return {
            repo: `${project.repositoryOwner}/${project.repositoryName}`,
            permissions: repo.permissions,
            canPush: repo.permissions?.push || false,
            canAdmin: repo.permissions?.admin || false,
          };
        } catch (error: any) {
          return {
            repo: `${project.repositoryOwner}/${project.repositoryName}`,
            error: error.message,
            status: error.status,
          };
        }
      })
    );

    return NextResponse.json({
      user: {
        login: user.login,
        name: user.name,
        email: user.email,
      },
      tokenScopes: scopes,
      tokenExpiresAt: account.expires_at 
        ? new Date(account.expires_at * 1000).toISOString() 
        : 'No expiration (OAuth App token)',
      hasRefreshToken: !!account.refresh_token,
      yourRepos: repos.slice(0, 5).map(r => ({
        name: r.full_name,
        permissions: r.permissions,
      })),
      projectRepositories: repoPermissions,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      status: error.status,
      hint: error.status === 401 
        ? 'Token is invalid or expired. Sign out and sign back in.' 
        : 'Unknown error',
    }, { status: 500 });
  }
}
