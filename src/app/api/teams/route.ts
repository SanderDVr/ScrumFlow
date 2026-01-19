import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/teams - Haal teams op
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Voor docenten: toon alle teams van hun klassen
    // Voor studenten: toon alleen teams waar ze lid van zijn
    let teams;
    
    if (user.role === "teacher") {
      // Haal alle klassen van de docent op
      const teacherClasses = await prisma.class.findMany({
        // where: { teacherId: user.id },
        select: { id: true },
      });
      
      const classIds = teacherClasses.map(c => c.id);
      
      teams = await prisma.team.findMany({
        where: {
          classId: {
            in: classIds,
          },
        },
        include: {
          class: {
            select: {
              id: true,
              name: true,
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
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else {
      // Studenten zien alleen teams waar ze lid van zijn
      teams = await prisma.team.findMany({
        where: {
          members: {
            some: {
              userId: user.id,
            },
          },
        },
        include: {
          class: {
            select: {
              id: true,
              name: true,
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
                },
              },
            },
          },
          projects: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

// POST /api/teams - Maak een nieuw team aan (alleen docenten)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Alleen docenten kunnen teams aanmaken
    if (user.role !== "teacher") {
      return NextResponse.json(
        { error: "Only teachers can create teams" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, classId } = body;

    if (!name || !classId) {
      return NextResponse.json(
        { error: "Name and classId are required" },
        { status: 400 }
      );
    }

    // Verifieer dat de klas bestaat en van deze docent is
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return NextResponse.json(
        { error: "Class not found" },
        { status: 404 }
      );
    }

    // if (classData.teacherId !== user.id) {
    //   return NextResponse.json(
    //     { error: "You can only create teams for your own classes" },
    //     { status: 403 }
    //   );
    // }

    // Check of er al een team met deze naam bestaat in deze klas
    const existingTeam = await prisma.team.findFirst({
      where: {
        name,
        classId,
      },
    });

    if (existingTeam) {
      return NextResponse.json(
        { error: "Er bestaat al een team met deze naam in deze klas" },
        { status: 400 }
      );
    }

    // Maak team aan met automatisch een project
    const team = await prisma.team.create({
      data: {
        name,
        description,
        classId,
        projects: {
          create: {
            name: `${name} Project`,
            description: `Project voor ${name}`,
          },
        },
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        members: true,
        projects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Return team met het project
    return NextResponse.json({
      ...team,
      project: team.projects[0], // Voeg het eerste (en enige) project toe als 'project' property
    });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}
