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

  useEffect(() => {
    if (session?.user?.role === "teacher") {
      fetchClasses();
    }
  }, [session]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

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
        const addMemberPromises = selectedStudents.map((studentId) =>
          fetch(`/api/teams/${team.id}/members`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: studentId,
              role: "developer",
            }),
          })
        );

        await Promise.all(addMemberPromises);
      }

      router.push(`/teams/${team.id}`);
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
                Beschrijving (optioneel)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Beschrijving van het team"
                rows={4}
              />
            </div>

            {classId && availableStudents.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Selecteer studenten ({selectedStudents.length} geselecteerd)
                </label>
                <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                  {availableStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {student.image && (
                        <img
                          src={student.image}
                          alt={student.name || "Student"}
                          className="h-8 w-8 rounded-full"
                        />
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {student.name || "Onbekende student"}
                        </div>
                        {student.email && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {student.email}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {classId && availableStudents.length === 0 && (
              <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                Er zijn geen studenten in deze klas
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 rounded-lg border border-gray-300 px-6 py-3 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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
