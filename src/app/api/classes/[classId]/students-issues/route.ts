import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET /api/classes/[classId]/students-issues - Haal alle studenten met hun issues voor een klas
export async function GET(
  request: Request,
  context: { params: Promise<{ classId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { classId } = await context.params;
  const { searchParams } = new URL(request.url);
  const sprintId = searchParams.get("sprintId");

  try {
    // Verificeer toegang tot de klas
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: true,
      },
    });

    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Check of de gebruiker toegang heeft tot deze klas
    if (
      session.user.role === "teacher" &&
      classData.teacherId !== session.user.id
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (
      session.user.role === "student" &&
      !classData.students.some((s) => s.id === session.user.id)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Haal alle teams op voor deze klas met hun projecten
    const teams = await prisma.team.findMany({
      where: {
        classId: classId,
      },
      include: {
        projects: {
          include: {
            sprints: {
              where: sprintId ? { id: sprintId } : { status: "active" },
            },
          },
        },
      },
    });

    // Probeer GitHub access token van de ingelogde gebruiker te krijgen
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "github",
      },
    });

    // Sync issues van GitHub voor elk project
    for (const team of teams) {
      for (const project of team.projects) {
        if (project.repositoryOwner && project.repositoryName) {
          const repoUrl = `https://api.github.com/repos/${project.repositoryOwner}/${project.repositoryName}/issues?state=all`;
          
          let githubResponse;
          
          if (account?.access_token) {
            githubResponse = await fetch(repoUrl, {
              headers: {
                Authorization: `Bearer ${account.access_token}`,
                Accept: "application/vnd.github.v3+json",
              },
            });
            
            if (!githubResponse.ok && githubResponse.status === 401) {
              githubResponse = await fetch(repoUrl, {
                headers: {
                  Accept: "application/vnd.github.v3+json",
                },
              });
            }
          } else {
            githubResponse = await fetch(repoUrl, {
              headers: {
                Accept: "application/vnd.github.v3+json",
              },
            });
          }

          if (githubResponse.ok) {
            const githubIssues = await githubResponse.json();
            console.log(`Fetched ${githubIssues.length} issues from ${project.repositoryOwner}/${project.repositoryName}`);

            // Sync issues met database
            for (const issue of githubIssues) {
              // Skip pull requests
              if (issue.pull_request) continue;
              
              console.log(`Syncing issue #${issue.number}: ${issue.title}, assignees:`, issue.assignees);
              
              await prisma.gitHubIssue.upsert({
                where: {
                  projectId_issueNumber: {
                    projectId: project.id,
                    issueNumber: issue.number,
                  },
                },
                update: {
                  title: issue.title,
                  body: issue.body || null,
                  state: issue.state,
                  htmlUrl: issue.html_url,
                  labels: JSON.stringify(issue.labels),
                  assignees: JSON.stringify(issue.assignees),
                  githubUpdatedAt: new Date(issue.updated_at),
                },
                create: {
                  projectId: project.id,
                  sprintId: null,
                  issueNumber: issue.number,
                  title: issue.title,
                  body: issue.body || null,
                  state: issue.state,
                  htmlUrl: issue.html_url,
                  status: "todo",
                  labels: JSON.stringify(issue.labels),
                  assignees: JSON.stringify(issue.assignees),
                  githubCreatedAt: new Date(issue.created_at),
                  githubUpdatedAt: new Date(issue.updated_at),
                },
              });
            }
          } else {
            console.error(`Failed to fetch issues from ${project.repositoryOwner}/${project.repositoryName}: ${githubResponse.status}`);
          }
        }
      }
    }

    // Haal alle studenten op met hun teams en issues
    const studentsWithIssues = await Promise.all(
      classData.students.map(async (student) => {
        // Haal team memberships op voor deze student
        const teamMemberships = await prisma.teamMember.findMany({
          where: {
            userId: student.id,
          },
          include: {
            team: {
              include: {
                class: true,
                projects: {
                  include: {
                    sprints: {
                      where: sprintId ? { id: sprintId } : { status: "active" },
                      include: {
                        githubIssues: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        // Verzamel alle issues voor deze student
        const allIssues: any[] = [];
        const sprints: any[] = [];

        teamMemberships.forEach((membership) => {
          membership.team.projects.forEach((project) => {
            project.sprints.forEach((sprint) => {
              sprints.push({
                id: sprint.id,
                name: sprint.name,
                status: sprint.status,
                teamName: membership.team.name,
                projectName: project.name,
              });

              sprint.githubIssues.forEach((issue) => {
                // Check of deze student is toegewezen aan dit issue
                let isAssigned = false;
                
                if (issue.assignees) {
                  try {
                    const assignees = JSON.parse(issue.assignees);
                    console.log(`Checking issue #${issue.issueNumber} for student ${student.email}:`, assignees);
                    // Check of de student's GitHub login of email in assignees staat
                    isAssigned = assignees.some((assignee: any) => {
                      return (
                        (assignee.login && student.email?.includes(assignee.login)) ||
                        assignee.email === student.email
                      );
                    });
                    console.log(`Student ${student.email} assigned to #${issue.issueNumber}:`, isAssigned);
                  } catch (e) {
                    // Als assignees niet parseable is, negeer het
                    console.error(`Failed to parse assignees for issue #${issue.issueNumber}:`, e);
                  }
                }

                // Voor nu: voeg ALLE issues toe (niet alleen toegewezen) voor debugging
                // Later kunnen we dit weer veranderen naar alleen toegewezen issues
                allIssues.push({
                  ...issue,
                  sprintName: sprint.name,
                  teamName: membership.team.name,
                  projectName: project.name,
                  isAssignedToStudent: isAssigned,
                });
              });
            });
          });
        });

        return {
          id: student.id,
          name: student.name,
          email: student.email,
          image: student.image,
          sprints,
          issues: allIssues,
          teamMemberships: teamMemberships.map((m) => ({
            teamId: m.team.id,
            teamName: m.team.name,
            role: m.role,
          })),
        };
      })
    );

    return NextResponse.json({
      students: studentsWithIssues,
    });
  } catch (error) {
    console.error("Error fetching student issues:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
