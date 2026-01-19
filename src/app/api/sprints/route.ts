import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    
    // Get all sprints accessible to the user
    if (user.role === "teacher") {
      // Teachers can see all sprints from their classes
      const sprints = await prisma.sprint.findMany({
        where: {
          project: {
            team: {
              class: {
                // teacherId: user.id,
              },
            },
          },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  class: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          startDate: 'asc',
        },
      });

      return NextResponse.json(sprints);
    } else {
      // Students can see sprints from their team
      const teamMembership = await prisma.teamMember.findFirst({
        where: {
          userId: user.id,
        },
        include: {
          team: {
            include: {
              projects: {
                include: {
                  sprints: {
                    orderBy: {
                      startDate: 'asc',
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!teamMembership) {
        return NextResponse.json([]);
      }

      const sprints = teamMembership.team.projects.flatMap(project => 
        project.sprints.map(sprint => ({
          ...sprint,
          project: {
            id: project.id,
            name: project.name,
            team: {
              id: teamMembership.team.id,
              name: teamMembership.team.name,
            },
          },
        }))
      );

      return NextResponse.json(sprints);
    }
  } catch (error) {
    console.error("Error fetching sprints:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    
    // Only teachers can create sprints
    if (user.role !== "teacher") {
      return NextResponse.json(
        { error: "Alleen docenten kunnen sprints aanmaken" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { projectId, name, goal, startDate, endDate, status } = body;

    if (!projectId || !name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Project ID, naam, startdatum en einddatum zijn verplicht" },
        { status: 400 }
      );
    }

    // Verify teacher owns the project through the team's class
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        team: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
    }

    // if (project.team.class.teacherId !== user.id) {
    //   return NextResponse.json(
    //     { error: "Je kunt alleen sprints aanmaken voor je eigen klassen" },
    //     { status: 403 }
    //   );
    // }

    // Validate dates
    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        { error: "Einddatum moet na startdatum zijn" },
        { status: 400 }
      );
    }

    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        name,
        goal: goal || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || "planned",
      },
    });

    return NextResponse.json(sprint, { status: 201 });
  } catch (error) {
    console.error("Error creating sprint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
