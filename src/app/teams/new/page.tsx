"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

type Class = {
  id: string;
  name: string;
  description: string | null;
  students: Array<{
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  }>;
};

type Student = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type StudentTeamInfo = {
  [studentId: string]: {
    teamName: string;
    teamId: string;
  };
};

export default function NewTeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentTeams, setStudentTeams] = useState<StudentTeamInfo>({});

  // Sprint planning
  const [sprints, setSprints] = useState<Array<{
    name: string;
    startDate: string;
    endDate: string;
  }>>([]);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintStartDate, setSprintStartDate] = useState("");
  const [sprintEndDate, setSprintEndDate] = useState("");

  useEffect(() => {
    if (session?.user?.role === "teacher") {
      fetchClasses();
      // Genereer automatisch 5 sprints
      generateDefaultSprints();
    }
  }, [session]);

  useEffect(() => {
    if (classId) {
      fetchStudentTeams(classId);
      setSelectedStudents([]); // Reset selectie bij klas wijziging
    }
  }, [classId]);

  const generateDefaultSprints = () => {
    const today = new Date();
    const nextMonday = getNextMonday(today);
    const defaultSprints = [];

    for (let i = 0; i < 5; i++) {
      const sprintStart = new Date(nextMonday);
      sprintStart.setDate(sprintStart.getDate() + (i * 7)); // Elke sprint begint 7 dagen later
      
      const sprintEnd = new Date(sprintStart);
      sprintEnd.setDate(sprintEnd.getDate() + 4); // Vrijdag (4 dagen na maandag)

      defaultSprints.push({
        name: `Sprint ${i + 1}`,
        startDate: sprintStart.toISOString().split('T')[0],
        endDate: sprintEnd.toISOString().split('T')[0],
      });
    }

    setSprints(defaultSprints);
  };

  const getNextMonday = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    result.setDate(result.getDate() + daysUntilMonday);
    return result;
  };

  const fetchClasses = async () => {
    try {
      const response = await fetch("/api/classes");
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchStudentTeams = async (selectedClassId: string) => {
    try {
      const response = await fetch("/api/teams");
      if (response.ok) {
        const teams = await response.json();
        const teamInfo: StudentTeamInfo = {};
        
        // Filter teams voor de geselecteerde klas en bouw een map van student -> team
        teams
          .filter((team: any) => team.class.id === selectedClassId)
          .forEach((team: any) => {
            team.members.forEach((member: any) => {
              teamInfo[member.userId] = {
                teamName: team.name,
                teamId: team.id,
              };
            });
          });
        
        setStudentTeams(teamInfo);
      }
    } catch (error) {
      console.error("Error fetching student teams:", error);
    }
  };

  const handleSubmitClick = () => {
    if (selectedStudents.length === 0) {
      setError("Selecteer minimaal één teamlid voordat je het team aanmaakt");
      // Scroll naar de error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validatie: er moeten teamleden geselecteerd zijn
    if (selectedStudents.length === 0) {
      setError("Selecteer minimaal één teamlid");
      setLoading(false);
      return;
    }

    try {
      // Stap 1: Maak het team aan
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          classId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Er is een fout opgetreden");
        setLoading(false);
        return;
      }

      const team = await response.json();

      // Stap 2: Voeg geselecteerde studenten toe aan het team
      if (selectedStudents.length > 0) {
        const addMemberResults = await Promise.allSettled(
          selectedStudents.map(async (studentId) => {
            const response = await fetch(`/api/teams/${team.id}/members`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: studentId,
                role: "developer",
              }),
            });
            
            if (!response.ok) {
              const data = await response.json();
              const student = availableStudents.find(s => s.id === studentId);
              throw new Error(`${student?.name || 'Student'}: ${data.error}`);
            }
            return response.json();
          })
        );

        // Check voor fouten bij het toevoegen van studenten
        const failures = addMemberResults.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
        if (failures.length > 0) {
          const errorMessages = failures.map(f => f.reason.message).join('\n');
          setError(`Team aangemaakt, maar problemen bij toevoegen studenten:\n${errorMessages}`);
          setLoading(false);
          // Redirect naar teams overzicht na 3 seconden
          setTimeout(() => router.push("/"), 3000);
          return;
        }
      }

      // Stap 3: Maak sprints aan als die zijn gedefinieerd
      if (sprints.length > 0 && team.project) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const createSprintPromises = sprints.map((sprint) => {
          const startDate = new Date(sprint.startDate);
          const endDate = new Date(sprint.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);

          // Sprint is actief als vandaag tussen start- en einddatum valt
          let status = "planned";
          if (today >= startDate && today <= endDate) {
            status = "active";
          } else if (today > endDate) {
            status = "completed";
          }

          return fetch("/api/sprints", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              projectId: team.project.id,
              name: sprint.name,
              startDate: sprint.startDate,
              endDate: sprint.endDate,
              status: status,
            }),
          });
        });

        await Promise.all(createSprintPromises);
      }

      router.push("/");
    } catch (error) {
      console.error("Error creating team:", error);
      setError("Er is een fout opgetreden bij het aanmaken van het team");
      setLoading(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const addSprint = () => {
    if (!sprintName || !sprintStartDate || !sprintEndDate) {
      alert("Vul alle verplichte velden in");
      return;
    }

    if (new Date(sprintEndDate) <= new Date(sprintStartDate)) {
      alert("Einddatum moet na startdatum zijn");
      return;
    }

    setSprints([...sprints, {
      name: sprintName,
      startDate: sprintStartDate,
      endDate: sprintEndDate,
    }]);

    // Reset form
    setSprintName("");
    setSprintStartDate("");
    setSprintEndDate("");
    setShowSprintForm(false);
  };

  const removeSprint = (index: number) => {
    setSprints(sprints.filter((_, i) => i !== index));
  };

  const updateSprint = (index: number, field: 'name' | 'startDate' | 'endDate', value: string) => {
    const updatedSprints = [...sprints];
    updatedSprints[index] = {
      ...updatedSprints[index],
      [field]: value,
    };
    setSprints(updatedSprints);
  };

  const selectedClass = classes.find((c) => c.id === classId);
  const availableStudents = selectedClass?.students || [];

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Laden...</div>
      </div>
    );
  }

  if (!session) {
    router.push("/auth/signin");
    return null;
  }

  if (session.user?.role !== "teacher") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Geen toegang
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Alleen docenten kunnen teams aanmaken
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-blue-600 hover:text-blue-700"
          >
            Terug naar dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Terug naar dashboard
          </Link>
        </div>

        <div className="rounded-lg bg-white p-8 shadow dark:bg-gray-800">
          <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
            Nieuw Team Aanmaken
          </h1>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="classId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Klas *
              </label>
              <select
                id="classId"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Selecteer een klas</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Alleen studenten uit deze klas kunnen aan het team worden toegevoegd
              </p>
            </div>

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Teamnaam *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="bijv. Team A"
                required
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Project beschrijving (optioneel)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Beschrijving van het project"
                rows={4}
              />
            </div>

            {classId && availableStudents.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selecteer studenten * ({selectedStudents.length} geselecteerd)
                </label>
                <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                  {availableStudents.map((student) => {
                    const isInTeam = studentTeams[student.id];
                    return (
                      <label
                        key={student.id}
                        className={`flex items-center gap-3 p-2 rounded ${
                          isInTeam 
                            ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => !isInTeam && toggleStudent(student.id)}
                          disabled={!!isInTeam}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                        {student.image && (
                          <img
                            src={student.image}
                            alt={student.name || "Student"}
                            className="h-8 w-8 rounded-full"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {student.name || "Onbekende student"}
                            </div>
                            {isInTeam && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                In team: {isInTeam.teamName}
                              </span>
                            )}
                          </div>
                          {student.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {student.email}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {classId && availableStudents.length === 0 && (
              <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                Er zijn geen studenten in deze klas
              </div>
            )}

            {/* Sprint Planning Sectie */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Sprint Planning (optioneel)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Definieer sprints voor dit team. De eerste sprint wordt automatisch actief.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSprintForm(!showSprintForm)}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700"
                >
                  + Sprint Toevoegen
                </button>
              </div>

              {/* Sprint Form */}
              {showSprintForm && (
                <div className="mb-4 rounded-lg border border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Sprint Naam *
                      </label>
                      <input
                        type="text"
                        value={sprintName}
                        onChange={(e) => setSprintName(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="bijv. Sprint 1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Startdatum *
                        </label>
                        <input
                          type="date"
                          value={sprintStartDate}
                          onChange={(e) => setSprintStartDate(e.target.value)}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Einddatum *
                        </label>
                        <input
                          type="date"
                          value={sprintEndDate}
                          onChange={(e) => setSprintEndDate(e.target.value)}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={addSprint}
                        className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700"
                      >
                        Sprint Toevoegen
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSprintForm(false)}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sprint List */}
              {sprints.length > 0 && (
                <div className="space-y-2">
                  {sprints.map((sprint, index) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const startDate = new Date(sprint.startDate);
                    const endDate = new Date(sprint.endDate);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(23, 59, 59, 999);

                    let status = "planned";
                    let statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
                    let statusText = "Gepland";

                    if (today >= startDate && today <= endDate) {
                      status = "active";
                      statusColor = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
                      statusText = "Actief";
                    } else if (today > endDate) {
                      status = "completed";
                      statusColor = "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
                      statusText = "Afgerond";
                    }

                    return (
                      <div
                        key={index}
                        className="rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-800"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={sprint.name}
                              onChange={(e) => updateSprint(index, 'name', e.target.value)}
                              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                              {statusText}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSprint(index)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                              title="Verwijderen"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Startdatum
                              </label>
                              <input
                                type="date"
                                value={sprint.startDate}
                                onChange={(e) => updateSprint(index, 'startDate', e.target.value)}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Einddatum
                              </label>
                              <input
                                type="date"
                                value={sprint.endDate}
                                onChange={(e) => updateSprint(index, 'endDate', e.target.value)}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 rounded-lg border border-gray-300 px-6 py-3 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annuleren
              </button>
              <button
                type={selectedStudents.length === 0 ? "button" : "submit"}
                onClick={selectedStudents.length === 0 ? handleSubmitClick : undefined}
                disabled={loading}
                className={`flex-1 rounded-lg px-6 py-3 text-white transition-colors ${
                  selectedStudents.length === 0
                    ? "bg-gray-400 cursor-not-allowed dark:bg-gray-600"
                    : "bg-blue-600 hover:bg-blue-700"
                } ${loading ? "opacity-50" : ""}`}
              >
                {loading ? "Aanmaken..." : "Team Aanmaken"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
