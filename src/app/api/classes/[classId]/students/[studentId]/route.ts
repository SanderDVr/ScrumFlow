import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// DELETE /api/classes/[classId]/students/[studentId] - Verwijder een student uit de klas
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  try {
    const { classId, studentId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Controleer of de gebruiker de docent van deze klas is
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // if (classData.teacherId !== session.user.id) {
    //   return NextResponse.json(
    //     { error: "Only the teacher can remove students" },
    //     { status: 403 }
    //   );
    // }

    // Verwijder de student uit de klas (zet classId op null)
    const updatedStudent = await prisma.user.update({
      where: { id: studentId },
      data: { classId: null },
    });

    return NextResponse.json({
      message: "Student removed from class",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error removing student from class:", error);
    return NextResponse.json(
      { error: "Failed to remove student from class" },
      { status: 500 }
    );
  }
}
