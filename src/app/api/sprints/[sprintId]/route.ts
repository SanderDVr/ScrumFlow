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

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: {
          include: {
            team: {
              include: {
                class: true,
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

    // Check authorization
    const user = session.user as { id: string; role: string };
    if (user.role === "teacher") {
      // Teachers can see sprints from their classes
      const teacherClass = await prisma.class.findFirst({
        where: {
          id: sprint.project.team.classId,
          // teacherId: user.id,
        },
      });

      if (!teacherClass) {
        return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
      }
    } else {
      // Students can only see their team's sprints
      const isMember = sprint.project.team.members.some((m) => m.userId === user.id);
      if (!isMember) {
        return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
      }
    }

    return NextResponse.json(sprint);
  } catch (error) {
    console.error("Error fetching sprint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
