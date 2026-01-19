"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ClassOption {
  id: string;
  name: string;
  description: string | null;
}

export default function JoinClassPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      fetchClasses();
    }
  }, [status, router]);

  const fetchClasses = async () => {
    try {
      const response = await fetch("/api/classes/available");
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
    
    if (!selectedClassId) {
      setMessage("Selecteer een klas");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/classes/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classId: selectedClassId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Aanvraag verzonden! Wacht op goedkeuring van de docent.");
        setTimeout(() => router.push("/"), 2000);
      } else {
        setMessage(data.error || "Er ging iets mis");
      }
    } catch (error) {
      console.error("Error requesting class:", error);
      setMessage("Er is een fout opgetreden");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-300">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Aanmelden voor een klas
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
          Selecteer een klas en wacht op goedkeuring van de docent
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="class"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Selecteer een klas
              </label>
              <select
                id="class"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                disabled={loading}
              >
                <option value="">-- Kies een klas --</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                    {cls.description && ` - ${cls.description}`}
                  </option>
                ))}
              </select>
            </div>

            {message && (
              <div
                className={`p-4 rounded-md ${
                  message.includes("verzonden")
                    ? "bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200"
                }`}
              >
                <p className="text-sm">{message}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !selectedClassId}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Bezig..." : "Aanvraag verzenden"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                ← Terug naar dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
