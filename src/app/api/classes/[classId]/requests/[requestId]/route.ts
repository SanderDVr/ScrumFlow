import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// PATCH /api/classes/[classId]/requests/[requestId] - Accept or reject a class request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string; requestId: string }> }
) {
  try {
    const { classId, requestId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json();

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Check if user is the teacher of this class
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    if (classData.teacherId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the teacher can manage requests" },
        { status: 403 }
      );
    }

    const classRequest = await prisma.classRequest.findUnique({
      where: { id: requestId },
    });

    if (!classRequest || classRequest.classId !== classId) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (action === "accept") {
      // Accept: update request status and add student to class
      await prisma.$transaction([
        prisma.classRequest.update({
          where: { id: requestId },
          data: { status: "accepted" },
        }),
        prisma.user.update({
          where: { id: classRequest.userId },
          data: { classId: classId },
        }),
      ]);

      return NextResponse.json({
        message: "Student accepted",
      });
    } else {
      // Reject: update request status
      await prisma.classRequest.update({
        where: { id: requestId },
        data: { status: "rejected" },
      });

      return NextResponse.json({
        message: "Student rejected",
      });
    }
  } catch (error) {
    console.error("Error processing class request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
