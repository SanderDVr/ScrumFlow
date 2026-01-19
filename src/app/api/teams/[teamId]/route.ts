// PATCH /api/teams/[teamId] - Update team name (teachers only)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId } = await context.params;
    let name;
    try {
      const body = await request.json();
      name = body.name;
    } catch (e) {
      console.error("PATCH /api/teams/[teamId] JSON parse error:", e);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.length < 2) {
      return NextResponse.json({ error: "Teamnaam is ongeldig" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can update teams" }, { status: 403 });
    }
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { class: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    // Use ClassTeacher join for authorization
    const teacherLink = await prisma.classTeacher.findFirst({
      where: { classId: team.class.id, teacherId: user.id },
    });
    if (!teacherLink) {
      return NextResponse.json({ error: "You can only update teams from your own classes" }, { status: 403 });
    }
    try {
      const updated = await prisma.team.update({
        where: { id: teamId },
        data: { name },
      });
      return NextResponse.json({ message: "Teamnaam bijgewerkt", team: updated });
    } catch (e) {
      console.error("PATCH /api/teams/[teamId] prisma.team.update error:", e);
      return NextResponse.json({ error: "Failed to update team name (db error)" }, { status: 500 });
    }
  } catch (error) {
    console.error("PATCH /api/teams/[teamId] unknown error:", error);
    return NextResponse.json({ error: "Failed to update team name (unknown error)" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/teams/[teamId] - Haal specifiek team op
export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await context.params;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            teachers: true, // Array of ClassTeacher
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                classId: true,
              },
            },
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check autorisatie: docent van de klas (via ClassTeacher) of lid van het team
    const isTeacher = user.role === "teacher" && Array.isArray(team.class.teachers) && team.class.teachers.some((t: any) => t.teacherId === user.id);
    const isMember = Array.isArray(team.members) && team.members.some((m: any) => m.user && m.user.id === user.id);

    if (!isTeacher && !isMember) {
      return NextResponse.json(
        { error: "Not authorized to view this team" },
        { status: 403 }
      );
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId] - Verwijder team (alleen docenten)
export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== "teacher") {
      return NextResponse.json(
        { error: "Only teachers can delete teams" },
        { status: 403 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        class: true,
      },
    });

    console.log("DELETE team debug:", {
      teamId,
      teamClassId: team?.class?.id,
      teamClassName: team?.class?.name,
      userId: user.id,
      userRole: user.role,
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Use ClassTeacher join for authorization
    const teacherLinkForDelete = await prisma.classTeacher.findFirst({
      where: { classId: team.class.id, teacherId: user.id },
    });
    console.log("DELETE team teacherLink:", teacherLinkForDelete);

    if (!teacherLinkForDelete) {
      return NextResponse.json(
        { error: `You can only delete teams from your own classes (team.classId=${team.class.id}, userId=${user.id})` },
        { status: 403 }
      );
    }

    await prisma.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    );
  }
}
