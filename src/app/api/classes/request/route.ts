import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// POST /api/classes/request - Request to join a class
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { classId } = await request.json();

    if (!classId) {
      return NextResponse.json({ error: "Class ID is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== "student") {
      return NextResponse.json(
        { error: "Only students can request to join classes" },
        { status: 403 }
      );
    }

    if (user.classId) {
      return NextResponse.json(
        { error: "You are already in a class" },
        { status: 400 }
      );
    }

    // Check if class exists
    const classExists = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classExists) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Check if request already exists
    const existingRequest = await prisma.classRequest.findUnique({
      where: {
        classId_userId: {
          classId,
          userId: session.user.id,
        },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "You already have a pending request for this class" },
        { status: 400 }
      );
    }

    // Create the request
    const classRequest = await prisma.classRequest.create({
      data: {
        classId,
        userId: session.user.id,
        status: "pending",
      },
    });

    return NextResponse.json(classRequest);
  } catch (error) {
    console.error("Error creating class request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
