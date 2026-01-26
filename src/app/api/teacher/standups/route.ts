// app/api/teacher/standups/route.ts
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
    
    if (user.role !== 'teacher') {
      return NextResponse.json(
        { error: "Alleen docenten hebben toegang" }, 
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const searchParams = req.nextUrl.searchParams;
    const sprintId = searchParams.get('sprintId');
    const teamId = searchParams.get('teamId');
    const classId = searchParams.get('classId');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const projectId = searchParams.get('projectId');

    // Get ALL classes (not filtered by teacher)
    const allClasses = await prisma.class.findMany({
      where: classId ? { id: classId } : undefined,
      include: {
        teams: {
          where: teamId ? { id: teamId } : undefined,
          include: {
            members: {
              where: userId ? { userId } : undefined,
            },
            projects: {
              where: projectId ? { id: projectId } : undefined,
              include: {
                sprints: {
                  where: sprintId ? { id: sprintId } : undefined,
                  include: {
                    standups: {
                      where: {
                        ...(startDate && { date: { gte: new Date(startDate) } }),
                        ...(endDate && { date: { lte: new Date(endDate) } }),
                      },
                      include: {
                        user: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                          },
                        },
                        sprint: {
                          include: {
                            project: {
                              include: {
                                team: {
                                  include: {
                                    class: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      orderBy: { date: 'desc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Flatten and structure the response with context
    const standupsWithContext = allClasses.flatMap(cls =>
      cls.teams.flatMap(team =>
        team.projects.flatMap(project =>
          project.sprints.flatMap(sprint =>
            sprint.standups.map(standup => ({
              ...standup,
              context: {
                class: {
                  id: cls.id,
                  name: cls.name,
                },
                team: {
                  id: team.id,
                  name: team.name,
                },
                project: {
                  id: project.id,
                  name: project.name,
                },
                sprint: {
                  id: sprint.id,
                  name: sprint.name,
                  startDate: sprint.startDate,
                  endDate: sprint.endDate,
                },
              },
            }))
          )
        )
      )
    );

    // Get unique filters for frontend dropdowns
    const uniqueClasses = allClasses.map(cls => ({
      id: cls.id,
      name: cls.name,
    }));

    const uniqueTeams = allClasses.flatMap(cls =>
      cls.teams.map(team => ({
        id: team.id,
        name: team.name,
        classId: cls.id,
        className: cls.name,
      }))
    );

    const uniqueProjects = allClasses.flatMap(cls =>
      cls.teams.flatMap(team =>
        team.projects.map(project => ({
          id: project.id,
          name: project.name,
          teamId: team.id,
          teamName: team.name,
          classId: cls.id,
          className: cls.name,
        }))
      )
    );

    const uniqueSprints = allClasses.flatMap(cls =>
      cls.teams.flatMap(team =>
        team.projects.flatMap(project =>
          project.sprints.map(sprint => ({
            id: sprint.id,
            name: sprint.name,
            projectId: project.id,
            projectName: project.name,
            teamId: team.id,
            teamName: team.name,
            classId: cls.id,
            className: cls.name,
          }))
        )
      )
    );

    return NextResponse.json({
      standups: standupsWithContext,
      count: standupsWithContext.length,
      filters: {
        classes: uniqueClasses,
        teams: uniqueTeams,
        projects: uniqueProjects,
        sprints: uniqueSprints,
      },
      metadata: {
        totalClasses: allClasses.length,
        totalTeams: uniqueTeams.length,
        totalProjects: uniqueProjects.length,
        totalSprints: uniqueSprints.length,
      },
    });
  } catch (error) {
    console.error("Error fetching teacher standups:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}