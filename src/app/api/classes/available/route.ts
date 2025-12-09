import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/classes/available - Get all available classes for students to request
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        classRequests: {
          select: {
            classId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all classes except the one user is already in or has pending requests for
    const requestedClassIds = user.classRequests.map((r) => r.classId);
    const excludeIds = user.classId
      ? [...requestedClassIds, user.classId]
      : requestedClassIds;

    const classes = await prisma.class.findMany({
      where: {
        id: {
          notIn: excludeIds,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(classes);
  } catch (error) {
    console.error("Error fetching available classes:", error);
    return NextResponse.json(
      { error: "Failed to fetch classes" },
      { status: 500 }
    );
  }
}
