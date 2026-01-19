import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET: List all teachers linked to this class
export async function GET(
  request: Request,
  context: { params: Promise<{ classId: string }> }
) {
  const { classId } = await context.params;
  const links = await prisma.classTeacher.findMany({
    where: { classId },
    include: { teacher: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ teachers: links.map(l => l.teacher) });
}

// POST: Link current user as teacher to this class
export async function POST(
  request: Request,
  context: { params: Promise<{ classId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { classId } = await context.params;
  await prisma.classTeacher.upsert({
    where: { classId_teacherId: { classId, teacherId: session.user.id } },
    update: {},
    create: { classId, teacherId: session.user.id },
  });
  return NextResponse.json({ message: "Linked teacher to class" });
}
