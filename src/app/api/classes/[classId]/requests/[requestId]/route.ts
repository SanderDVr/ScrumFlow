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

    console.log("[class request route] session:", {
      id: session.user.id,
      role: session.user.role,
      email: session.user.email,
    });

    // Read and validate body with helpful logging for debugging
    const rawBody = await request.text();
    console.log("[class request route]", { method: request.method, params: { classId, requestId }, rawBody });
    let parsedBody: any = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch (err) {
      console.error("Invalid JSON body for request:", rawBody, err);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    console.log("[class request route] parsedBody:", parsedBody);

    let { action } = parsedBody;

    // Accept synonyms from older frontends
    if (action === "approve") action = "accept";
    if (action === "decline") action = "reject";

    if (typeof action !== "string" || !["accept", "reject"].includes(action)) {
      console.error("Invalid action received", { method: request.method, body: parsedBody });
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Check if class exists
    const classData = await prisma.class.findUnique({ where: { id: classId } });

    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Verify the current user is a teacher linked to this class via ClassTeacher
    const teacherLink = await prisma.classTeacher.findFirst({
      where: { classId, teacherId: session.user.id },
    });

    console.log("[class request route] teacherLink:", teacherLink);

    if (!teacherLink) {
      return NextResponse.json(
        { error: "Only a teacher of this class can manage requests" },
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
        prisma.classRequest.delete({
          where: { id: requestId },
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
      await prisma.classRequest.delete({
        where: { id: requestId },
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

// Temporary compatibility: accept POST as an alias for PATCH (some clients/proxies may not preserve PATCH)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string; requestId: string }> }
) {
  // Delegate to PATCH handler so logic stays in one place
  return await PATCH(request, { params });
}
