import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getValidGitHubToken, getGitHubUsername } from "@/lib/github";

// GET /api/debug/test-sync - Test GitHub sync and closed issues
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  try {
    // Get all projects with repository info
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        repositoryOwner: true,
        repositoryName: true,
        repositoryUrl: true,
      },
    });

    // Test GitHub token
    const token = await getValidGitHubToken(userId);
    const githubUsername = await getGitHubUsername(userId);

    // Test GitHub API - get issue events
    let closedEventsTest = null;
    const projectWithRepo = projects.find(p => p.repositoryOwner && p.repositoryName);
    
    if (projectWithRepo && token) {
      // Get issue events to see closed events
      const eventsUrl = `https://api.github.com/repos/${projectWithRepo.repositoryOwner}/${projectWithRepo.repositoryName}/issues/events?per_page=100`;
      
      const eventsResponse = await fetch(eventsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        
        // Filter only closed events
        const closedEvents = events
          .filter((e: { event: string }) => e.event === 'closed')
          .map((e: { event: string; created_at: string; actor: { login: string }; issue: { number: number; title: string; state: string } }) => ({
            event: e.event,
            closedAt: e.created_at,
            closedBy: e.actor.login,
            issueNumber: e.issue.number,
            issueTitle: e.issue.title,
            issueState: e.issue.state,
          }));

        // Calculate yesterday's date range
        const now = new Date();
        const yesterdayStart = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - 1,
          0, 0, 0, 0
        ));
        const todayStart = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0, 0, 0, 0
        ));

        closedEventsTest = {
          success: true,
          url: eventsUrl,
          totalEvents: events.length,
          closedEventsCount: closedEvents.length,
          closedEvents: closedEvents.slice(0, 20), // Show last 20 closed events
          dateRange: {
            now: now.toISOString(),
            yesterdayStart: yesterdayStart.toISOString(),
            todayStart: todayStart.toISOString(),
          },
          currentUser: {
            githubUsername,
            matchingEvents: closedEvents.filter((e: { closedBy: string }) => 
              e.closedBy.toLowerCase() === (githubUsername || '').toLowerCase()
            ),
          },
        };
      } else {
        const errorText = await eventsResponse.text();
        closedEventsTest = {
          success: false,
          url: eventsUrl,
          status: eventsResponse.status,
          error: errorText,
        };
      }
    }

    // Get current issues in database
    const dbIssues = await prisma.gitHubIssue.findMany({
      take: 10,
      orderBy: { issueNumber: "desc" },
      select: {
        issueNumber: true,
        title: true,
        state: true,
        status: true,
      },
    });

    return NextResponse.json({
      user: {
        id: userId,
        hasToken: !!token,
        githubUsername,
      },
      projects,
      closedEventsTest,
      dbIssues,
    });
  } catch (error) {
    return NextResponse.json({ 
      error: "Error", 
      message: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
