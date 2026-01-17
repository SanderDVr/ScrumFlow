import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getValidGitHubToken } from "@/lib/github";

// GET /api/sprints/[sprintId]/issues - Haal GitHub issues op
export async function GET(
  request: Request,
  context: { params: Promise<{ sprintId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sprintId } = await context.params;

  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: {
          include: {
            team: {
              include: {
                class: true,
              },
            },
            githubIssues: {
              where: {
                sprintId: sprintId,
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }

    // Als er repository info is, haal issues op van GitHub
    if (sprint.project.repositoryOwner && sprint.project.repositoryName) {
      const repoUrl = `https://api.github.com/repos/${sprint.project.repositoryOwner}/${sprint.project.repositoryName}/issues?state=all`;
      console.log(`Fetching issues from ${sprint.project.repositoryOwner}/${sprint.project.repositoryName}`);
      console.log(`Full URL: ${repoUrl}`);
      
      // Get valid GitHub access token (will auto-refresh if expired)
      const accessToken = await getValidGitHubToken(session.user.id);
      
      console.log(`Valid access token available: ${accessToken ? 'yes' : 'no'}`);

      let githubResponse;
      
      if (accessToken) {
        console.log("Using authenticated GitHub API request");
        githubResponse = await fetch(repoUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        
        console.log(`Authenticated response status: ${githubResponse.status}`);
        
        // Als authenticated request faalt, probeer public API
        if (!githubResponse.ok && githubResponse.status === 401) {
          console.log("Authenticated request failed, falling back to public API");
          githubResponse = await fetch(repoUrl, {
            headers: {
              Accept: "application/vnd.github.v3+json",
            },
          });
          console.log(`Public API response status: ${githubResponse.status}`);
        }
      } else {
        console.log("No GitHub token, trying public API");
        // Probeer zonder authenticatie voor publieke repos
        githubResponse = await fetch(repoUrl, {
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        });
        console.log(`Public API response status: ${githubResponse.status}`);
      }

      if (githubResponse.ok) {
        const githubIssues = await githubResponse.json();
        console.log(`Fetched ${githubIssues.length} issues from GitHub`);

        // Sync issues met database
        for (const issue of githubIssues) {
          // Skip pull requests
          if (issue.pull_request) continue;

          console.log(`Syncing issue #${issue.number}: ${issue.title}`);
          
          // Determine status: closed issues automatically go to 'done'
          const statusForIssue = issue.state === 'closed' ? 'done' : undefined;
          
          await prisma.gitHubIssue.upsert({
            where: {
              projectId_issueNumber: {
                projectId: sprint.project.id,
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
              // If issue was closed on GitHub, move to done
              ...(issue.state === 'closed' ? { status: 'done' } : {}),
            },
            create: {
              projectId: sprint.project.id,
              sprintId: null, // Nog niet toegewezen aan sprint
              issueNumber: issue.number,
              title: issue.title,
              body: issue.body || null,
              state: issue.state,
              htmlUrl: issue.html_url,
              status: statusForIssue || "todo",
              labels: JSON.stringify(issue.labels),
              assignees: JSON.stringify(issue.assignees),
              githubCreatedAt: new Date(issue.created_at),
              githubUpdatedAt: new Date(issue.updated_at),
            },
          });
        }
        console.log("Sync completed");
      } else {
        console.error(`GitHub API error: ${githubResponse.status} - ${await githubResponse.text()}`);
      }
    }

    // Haal alle issues van het project op (inclusief niet-toegewezen)
    const allIssues = await prisma.gitHubIssue.findMany({
      where: {
        projectId: sprint.project.id,
      },
      orderBy: {
        issueNumber: "asc",
      },
    });

    // Splits in sprint issues en backlog
    const sprintIssues = allIssues.filter(i => i.sprintId === sprintId);
    const backlogIssues = allIssues.filter(i => i.sprintId === null);

    return NextResponse.json({
      sprintIssues,
      backlogIssues,
      allIssues,
    });
  } catch (error) {
    console.error("Error fetching issues:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/sprints/[sprintId]/issues - Assign issue to sprint
export async function POST(
  request: Request,
  context: { params: Promise<{ sprintId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sprintId } = await context.params;
  const { issueId } = await request.json();

  if (!issueId) {
    return NextResponse.json({ error: "Missing issueId" }, { status: 400 });
  }

  try {
    const issue = await prisma.gitHubIssue.update({
      where: { id: issueId },
      data: { 
        sprintId: sprintId,
        status: "todo",
      },
    });

    return NextResponse.json(issue);
  } catch (error) {
    console.error("Error assigning issue:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/sprints/[sprintId]/issues - Update issue status
export async function PATCH(
  request: Request,
  context: { params: Promise<{ sprintId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sprintId } = await context.params;
  const { issueId, status } = await request.json();

  if (!issueId || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Prevent manually moving issues to "done" - this should only happen via GitHub
  if (status === "done") {
    return NextResponse.json({ 
      error: "Issues kunnen alleen naar 'Done' worden verplaatst door ze te sluiten op GitHub." 
    }, { status: 400 });
  }

  try {
    // Check if issue is already closed - closed issues cannot be moved
    const existingIssue = await prisma.gitHubIssue.findUnique({
      where: { id: issueId },
      select: { state: true, status: true },
    });

    if (!existingIssue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    // Don't allow moving closed issues
    if (existingIssue.state === "closed" || existingIssue.status === "done") {
      return NextResponse.json({ 
        error: "Gesloten issues kunnen niet worden verplaatst." 
      }, { status: 400 });
    }

    const issue = await prisma.gitHubIssue.update({
      where: { id: issueId },
      data: { status },
    });

    return NextResponse.json(issue);
  } catch (error) {
    console.error("Error updating issue:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
