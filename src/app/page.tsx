"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Team = {
  id: string;
  name: string;
  description: string | null;
  class: {
    id: string;
    name: string;
  };
  members: Array<{ user: { name: string | null; image: string | null } }>;
};

type UserData = {
  classId: string | null;
};

type Class = {
  id: string;
  name: string;
  description: string | null;
  students: Array<{ id: string; name: string | null }>;
  teams: Array<{ id: string; name: string }>;
  classRequests: Array<{ id: string }>;
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const [teamsRes, userRes, classesRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/user"),
        fetch("/api/classes"),
      ]);

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);
      }

      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setClasses(classesData);
      }

      if (userRes.ok) {
        const user = await userRes.json();
        setUserData(user);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newClassName,
          description: newClassDescription,
        }),
      });

      if (response.ok) {
        const newClass = await response.json();
        setClasses([newClass, ...classes]);
        console.log("test");
        setShowNewClassModal(false);
        setNewClassName("");
        setNewClassDescription("");
      } else {
        const errorData = await response.json();
        console.error("Error creating class:", errorData);
        alert("Fout bij aanmaken van klas: " + (errorData.error || "Onbekende fout"));
      }
    } catch (error) {
      console.error("Error creating class:", error);
      alert("Fout bij aanmaken van klas");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Laden...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white">
            ScrumFlow
          </h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
            Beheer je Scrum projecten met gemak
          </p>
        </div>
        <button
          onClick={() => signIn("github")}
          className="rounded-lg bg-gray-900 px-6 py-3 text-white transition-colors hover:bg-gray-800"
        >
          Inloggen met GitHub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ScrumFlow
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              )}
              <div className="text-sm">
                <div className="font-medium text-gray-900 dark:text-white">
                  {session.user?.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {session.user?.role === "teacher" ? "Docent" : "Student"}
                </div>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
            >
              Uitloggen
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Overzicht van je teams, projecten en actieve sprints
          </p>
        </div>

        {loading ? (
          <div className="text-center">
            <div className="text-gray-600 dark:text-gray-400">Laden...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Voor studenten: toon hun team en project info */}
            {session.user?.role === "student" ? (
              <>
                {/* Klasloze student melding */}
                {!userData?.classId && (
                  <div className="rounded-lg bg-yellow-50 border-2 border-yellow-200 p-8 text-center dark:bg-yellow-900/20 dark:border-yellow-800">
                    <div className="mx-auto max-w-md">
                      <svg
                        className="mx-auto h-12 w-12 text-yellow-600 dark:text-yellow-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                        Je bent nog niet toegevoegd aan een klas
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Om teams te kunnen maken en projecten te starten, moet je eerst
                        lid worden van een klas. Selecteer een klas en wacht op
                        goedkeuring van je docent.
                      </p>
                      <Link
                        href="/join-class"
                        className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                      >
                        Kies een klas
                      </Link>
                    </div>
                  </div>
                )}

                {/* Student heeft geen team */}
                {teams.length === 0 ? (
                  <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                      Nog geen team
                    </h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                      Je bent nog niet toegevoegd aan een team. Vraag je docent om je aan een team toe te voegen.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Student team info */}
                    <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                      <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                        Mijn Team
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {teams[0].name}
                          </h4>
                          {teams[0].description && (
                            <p className="mt-2 text-gray-600 dark:text-gray-400">
                              {teams[0].description}
                            </p>
                          )}
                        </div>
                        <div>
                          <h5 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                            Teamleden ({teams[0].members.length})
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {teams[0].members.map((member, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-700"
                              >
                                {member.user.image ? (
                                  <Image
                                    src={member.user.image}
                                    alt={member.user.name || "Member"}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                  />
                                ) : (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-xs dark:bg-gray-600">
                                    {member.user.name?.charAt(0) || "?"}
                                  </div>
                                )}
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {member.user.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Voor docenten: statistieken en overzicht van alle teams */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Teams
                        </p>
                        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                          {teams.length}
                        </p>
                      </div>
                      <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
                        <svg
                          className="h-6 w-6 text-blue-600 dark:text-blue-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Klassen
                        </p>
                        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                          {classes.length}
                        </p>
                      </div>
                      <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                        <svg
                          className="h-6 w-6 text-green-600 dark:text-green-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

            {/* Classes - Alleen voor docenten */}
            {session?.user?.role === "teacher" && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Klassen
                  </h3>
                  <button
                    onClick={() => setShowNewClassModal(true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
                  >
                    + Nieuwe Klas
                  </button>
                </div>

              {classes.length === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
                  <p className="text-gray-600 dark:text-gray-400">
                    Je hebt nog geen klassen. Maak je eerste klas aan!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {classes.map((classItem) => (
                    <Link
                      key={classItem.id}
                      href={`/classes/${classItem.id}`}
                      className="block rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg dark:bg-gray-800"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {classItem.name}
                          </h4>
                          {classItem.description && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              {classItem.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {classItem.students.length} student(en)
                        </span>
                        <div className="flex items-center gap-2">
                          {classItem.classRequests && classItem.classRequests.length > 0 && (
                            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                              {classItem.classRequests.length} aanvra{classItem.classRequests.length === 1 ? 'ag' : 'gen'}
                            </span>
                          )}
                          <span className="text-gray-600 dark:text-gray-400">
                            {classItem.teams.length} team(s)
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              </div>
            )}

            {/* Teams */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Teams
                </h3>
                <Link
                  href="/teams/new"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                >
                  + Nieuw Team
                </Link>
              </div>

              {teams.length === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
                  <p className="text-gray-600 dark:text-gray-400">
                    Je hebt nog geen teams. Maak je eerste team aan!
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Groepeer teams per klas */}
                  {Array.from(new Set(teams.map(t => t.class.id))).map((classId) => {
                    const classTeams = teams.filter(t => t.class.id === classId);
                    const className = classTeams[0]?.class.name;
                    
                    return (
                      <div key={classId}>
                        <h4 className="mb-3 text-lg font-medium text-gray-700 dark:text-gray-300">
                          {className}
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {classTeams.map((team) => (
                            <Link
                              key={team.id}
                              href={`/teams/${team.id}`}
                              className="block rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg dark:bg-gray-800"
                            >
                              <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {team.name}
                              </h5>
                              {team.description && (
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                  {team.description}
                                </p>
                              )}
                              <div className="mt-4">
                                <div className="flex -space-x-2">
                                  {team.members.slice(0, 3).map((member, i) => (
                                    <div
                                      key={i}
                                      className="h-8 w-8 overflow-hidden rounded-full border-2 border-white dark:border-gray-800"
                                    >
                                      {member.user.image ? (
                                        <Image
                                          src={member.user.image}
                                          alt={member.user.name || "Member"}
                                          width={32}
                                          height={32}
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gray-300 text-xs dark:bg-gray-600">
                                          {member.user.name?.charAt(0) || "?"}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {team.members.length > 3 && (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs dark:border-gray-800 dark:bg-gray-700">
                                      +{team.members.length - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Modal voor nieuwe klas */}
      {showNewClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
              Nieuwe Klas Aanmaken
            </h2>
            <form onSubmit={createClass} className="space-y-4">
              <div>
                <label
                  htmlFor="className"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Klasnaam
                </label>
                <input
                  type="text"
                  id="className"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="bijv. SD2A"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="classDescription"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Beschrijving (optioneel)
                </label>
                <textarea
                  id="classDescription"
                  value={newClassDescription}
                  onChange={(e) => setNewClassDescription(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="Beschrijving van de klas"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewClassModal(false);
                    setNewClassName("");
                    setNewClassDescription("");
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                >
                  Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
