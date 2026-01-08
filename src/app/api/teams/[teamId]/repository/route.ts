import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const body = await req.json();
    const { repositoryUrl, repositoryOwner, repositoryName } = body;

    if (!repositoryUrl || !repositoryOwner || !repositoryName) {
      return NextResponse.json(
        { error: "Repository URL, owner en name zijn verplicht" },
        { status: 400 }
      );
    }

    // Verify user is member of the team
    const user = session.user as { id: string; role: string };
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Alleen teamleden kunnen de repository koppelen" },
        { status: 403 }
      );
    }

    // Find the project for this team
    const project = await prisma.project.findFirst({
      where: { teamId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
    }

    // Update the project with repository info
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        repositoryUrl,
        repositoryOwner,
        repositoryName,
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Error linking repository:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
