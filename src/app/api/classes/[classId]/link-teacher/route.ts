import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Temporary debug endpoint: POST /api/classes/[classId]/link-teacher
// Links the current session user as a teacher to the class (creates ClassTeacher row).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teacherId = session.user.id;

    // Check existing link
    const existing = await prisma.classTeacher.findFirst({ where: { classId, teacherId } });
    if (existing) {
      return NextResponse.json({ message: "Already linked", existing });
    }

    const link = await prisma.classTeacher.create({ data: { classId, teacherId } });

    return NextResponse.json({ message: "Linked as teacher", link });
  } catch (error) {
    console.error("[link-teacher] error:", error);
    return NextResponse.json({ error: "Failed to link teacher" }, { status: 500 });
  }
}
