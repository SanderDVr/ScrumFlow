import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// POST /api/teams/[teamId]/members - Voeg student toe aan team (alleen docenten)
export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await context.params;
    const body = await request.json();
    const { userId, role = "developer" } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== "teacher") {
      return NextResponse.json(
        { error: "Only teachers can add members to teams" },
        { status: 403 }
      );
    }

    // Haal team en klas informatie op
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        class: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Verifieer dat de docent eigenaar is van de klas
    if (team.class.teacherId !== user.id) {
      return NextResponse.json(
        { error: "You can only add members to teams in your own classes" },
        { status: 403 }
      );
    }

    // Haal de student op die toegevoegd moet worden
    const student = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // BELANGRIJKE VALIDATIE: Check of de student in dezelfde klas zit
    if (student.classId !== team.classId) {
      return NextResponse.json(
        { error: "Student must be in the same class as the team" },
        { status: 400 }
      );
    }

    // Check of student al lid is van een ander team in deze klas
    const existingTeamMembership = await prisma.teamMember.findFirst({
      where: {
        userId,
        team: {
          classId: team.classId,
        },
      },
      include: {
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    if (existingTeamMembership) {
      return NextResponse.json(
        { error: `Student zit al in team "${existingTeamMembership.team.name}"` },
        { status: 400 }
      );
    }

    // Check of student al lid is
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "Student is already a member of this team" },
        { status: 400 }
      );
    }

    // Voeg student toe aan team
    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role,
      },
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
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error adding team member:", error);
    return NextResponse.json(
      { error: "Failed to add team member" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/members - Verwijder student uit team
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== "teacher") {
      return NextResponse.json(
        { error: "Only teachers can remove members from teams" },
        { status: 403 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        class: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (team.class.teacherId !== user.id) {
      return NextResponse.json(
        { error: "You can only remove members from teams in your own classes" },
        { status: 403 }
      );
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
