import NextAuth, { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/auth/signin",
  },
  events: {
    async createUser({ user }) {
      // Check of de gebruiker een docent moet zijn
      const teacherEmails = process.env.TEACHER_EMAILS?.split(',').map(e => e.trim()) || [];
      
      if (user.email && teacherEmails.includes(user.email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "teacher" },
        });
      }
    },
  },
  callbacks: {
    async session({ session, user }) {
      // Voeg user id en role toe aan de session
      if (session.user) {
        session.user.id = user.id;
        // Haal de role op uit de database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        session.user.role = dbUser?.role || "student";
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
