import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

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

    // Verify user has access to this sprint
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: {
          include: {
            team: {
              include: {
                members: true,
                class: true,
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint niet gevonden" }, { status: 404 });
    }

    const user = session.user as { id: string; role: string };
    const isMember = sprint.project.team.members.some((m) => m.userId === user.id);
    const isTeacher =
      user.role === "teacher" &&
      (await prisma.class.findFirst({
        where: {
          id: sprint.project.team.classId,
          teacherId: user.id,
        },
      }));

    if (!isMember && !isTeacher) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const retrospectives = await prisma.retrospective.findMany({
      where: { sprintId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(retrospectives);
  } catch (error) {
    console.error("Error fetching retrospectives:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sprintId } = await params;
    const body = await req.json();
    const { whatWentWell, whatCanImprove, actionItems } = body;

    if (!whatWentWell || !whatCanImprove) {
      return NextResponse.json(
        { error: "What went well en what can improve zijn verplicht" },
        { status: 400 }
      );
    }

    // Verify user is member of team
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
      return NextResponse.json({ error: "Sprint niet gevonden" }, { status: 404 });
    }

    const user = session.user as { id: string };
    const isMember = sprint.project.team.members.some((m) => m.userId === user.id);

    if (!isMember) {
      return NextResponse.json(
        { error: "Alleen teamleden kunnen retrospectives toevoegen" },
        { status: 403 }
      );
    }

    // Check if retrospective already exists for this sprint
    const existingRetro = await prisma.retrospective.findUnique({
      where: {
        sprintId_userId: {
          sprintId,
          userId: user.id,
        },
      },
    });

    if (existingRetro) {
      return NextResponse.json(
        { error: "Je hebt al een retrospective ingevuld voor deze sprint" },
        { status: 400 }
      );
    }

    const retrospective = await prisma.retrospective.create({
      data: {
        sprintId,
        userId: user.id,
        whatWentWell,
        whatCanImprove,
        actionItems: actionItems || null,
      },
    });

    return NextResponse.json(retrospective, { status: 201 });
  } catch (error) {
    console.error("Error creating retrospective:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
