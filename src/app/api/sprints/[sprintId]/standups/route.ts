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
          // teacherId: user.id,
        },
      }));

    if (!isMember && !isTeacher) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const standups = await prisma.standup.findMany({
      where: { sprintId },
      orderBy: { date: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(standups);
  } catch (error) {
    console.error("Error fetching standups:", error);
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
    const { yesterday, today, blockers } = body;

    if (!yesterday || !today) {
      return NextResponse.json(
        { error: "Yesterday en today zijn verplicht" },
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
        { error: "Alleen teamleden kunnen stand-ups toevoegen" },
        { status: 403 }
      );
    }

    // Check if standup already exists for today
    const today_date = new Date();
    today_date.setHours(0, 0, 0, 0);

    const existingStandup = await prisma.standup.findFirst({
      where: {
        sprintId,
        userId: user.id,
        date: {
          gte: today_date,
        },
      },
    });

    if (existingStandup) {
      return NextResponse.json(
        { error: "Je hebt al een stand-up toegevoegd vandaag" },
        { status: 400 }
      );
    }

    const standup = await prisma.standup.create({
      data: {
        sprintId,
        userId: user.id,
        yesterday,
        today,
        blockers: blockers || null,
      },
    });

    return NextResponse.json(standup, { status: 201 });
  } catch (error) {
    console.error("Error creating standup:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
