import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getValidGitHubToken, getIssuesClosedByUserYesterday, getGitHubUsername } from "@/lib/github";

// GET /api/sprints/[sprintId]/closed-issues - Get issues closed by user yesterday
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sprintId } = await params;
    const user = session.user as { id: string };

    // Get sprint with project and repository info
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: {
          include: {
            team: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint niet gevonden", debug: { sprintId } }, { status: 404 });
    }

    // Check if user is member of the team
    const isMember = sprint.project.team.members.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    // Check if repository is linked
    if (!sprint.project.repositoryOwner || !sprint.project.repositoryName) {
      return NextResponse.json({ 
        closedIssues: [],
        message: "Geen repository gekoppeld",
        debug: {
          projectId: sprint.project.id,
          repositoryOwner: sprint.project.repositoryOwner,
          repositoryName: sprint.project.repositoryName,
        }
      });
    }

    // Get GitHub access token
    const accessToken = await getValidGitHubToken(user.id);
    if (!accessToken) {
      return NextResponse.json({ 
        closedIssues: [],
        message: "Geen GitHub token beschikbaar" 
      });
    }

    // Get the user's GitHub username
    const githubUsername = await getGitHubUsername(user.id);
    if (!githubUsername) {
      return NextResponse.json({ 
        closedIssues: [],
        message: "Kon GitHub gebruikersnaam niet ophalen" 
      });
    }

    // Get issues closed by the user yesterday
    const closedIssues = await getIssuesClosedByUserYesterday(
      accessToken,
      sprint.project.repositoryOwner,
      sprint.project.repositoryName,
      githubUsername
    );

    return NextResponse.json({
      closedIssues,
      githubUsername,
      repository: `${sprint.project.repositoryOwner}/${sprint.project.repositoryName}`,
      debug: {
        sprintId,
        projectId: sprint.project.id,
        issuesFound: closedIssues.length,
      }
    });
  } catch (error) {
    console.error("Error fetching closed issues:", error);
    return NextResponse.json({ error: "Internal server error", message: String(error) }, { status: 500 });
  }
}
