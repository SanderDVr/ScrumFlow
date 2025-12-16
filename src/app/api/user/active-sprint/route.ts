import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };

    // Alleen voor studenten
    if (user.role !== "student") {
      return NextResponse.json({ activeSprint: null });
    }

    const today = new Date();

    // Zoek het team van de student met sprints
    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: user.id },
      include: {
        team: {
          include: {
            projects: {
              include: {
                sprints: {
                  where: { 
                    status: "active",
                  },
                  orderBy: { startDate: "desc" },
                },
              },
            },
          },
        },
      },
    });

    // Filter in JavaScript voor betere datum controle
    const allSprints = teamMember?.team?.projects?.[0]?.sprints || [];
    const activeSprint = allSprints.find(sprint => {
      const startDate = new Date(sprint.startDate);
      const endDate = new Date(sprint.endDate);
      return today >= startDate && today <= endDate;
    });

    return NextResponse.json({
      activeSprint: activeSprint || null,
    });
  } catch (error) {
    console.error("Error fetching active sprint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
