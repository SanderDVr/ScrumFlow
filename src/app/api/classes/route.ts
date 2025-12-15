import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/classes - Haal alle klassen op
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

    // Voor docenten: toon alleen hun eigen klassen
    // Voor studenten: toon alle klassen
    const whereClause = user.role === "teacher" 
      ? { teacherId: user.id }
      : {};

    const classes = await prisma.class.findMany({
      where: whereClause,
      include: {
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
          },
        },
        requests: {
          where: {
            status: "pending",
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Map 'requests' to 'classRequests' voor frontend compatibility
    const classesWithRequests = classes.map(classItem => ({
      ...classItem,
      classRequests: classItem.requests,
    }));

    return NextResponse.json(classesWithRequests);
  } catch (error) {
    console.error("Error fetching classes:", error);
    return NextResponse.json(
      { error: "Failed to fetch classes" },
      { status: 500 }
    );
  }
}

// POST /api/classes - Maak een nieuwe klas aan (alleen docenten)
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

    // Alleen docenten kunnen klassen aanmaken
    if (user.role !== "teacher") {
      return NextResponse.json(
        { error: "Only teachers can create classes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Class name is required" },
        { status: 400 }
      );
    }

    const newClass = await prisma.class.create({
      data: {
        name,
        description,
        teacherId: user.id,
      },
      include: {
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    console.error("Error creating class:", error);
    return NextResponse.json(
      { error: "Failed to create class" },
      { status: 500 }
    );
  }
}
