import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status || !["todo", "in_progress", "done"].includes(status)) {
      return NextResponse.json(
        { error: "Ongeldige status. Gebruik: todo, in_progress, of done" },
        { status: 400 }
      );
    }

    // Verify user has access to this story
    // const story = await prisma.userStory.findUnique({
    //   where: { id: storyId },
    //   include: {
    //     sprint: {
    //       include: {
    //         project: {
    //           include: {
    //             team: {
    //               include: {
    //                 members: true,
    //                 class: true,
    //               },
    //             },
    //           },
    //         },
    //       },
    //     },
    //   },
    // });

    // if (!story) {
    //   return NextResponse.json({ error: "User story niet gevonden" }, { status: 404 });
    // }

    const user = session.user as { id: string; role: string };
    // const isMember = story.sprint.project.team.members.some((m) => m.userId === user.id);
    const isTeacher =
      user.role === "teacher" &&
      (await prisma.class.findFirst({
        where: {
          // id: story.sprint.project.team.classId,
          teacherId: user.id,
        },
      }));

    // if (!isMember && !isTeacher) {
    //   return NextResponse.json(
    //     { error: "Alleen teamleden kunnen user stories aanpassen" },
    //     { status: 403 }
    //   );
    // }

    // const updatedStory = await prisma.userStory.update({
    //   where: { id: storyId },
    //   data: { status },
    //   include: {
    //     assignee: {
    //       select: {
    //         id: true,
    //         name: true,
    //         image: true,
    //       },
    //     },
    //   },
    // });

    // return NextResponse.json(updatedStory);
  } catch (error) {
    console.error("Error updating user story:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
