"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Student {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface ClassRequest {
  id: string;
  status: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface ClassDetail {
  id: string;
  name: string;
  description: string | null;
  students: Student[];
  teams: Team[];
  teacherId: string;
  requests?: ClassRequest[];
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const fetchClassData = async () => {
    try {
      const response = await fetch(`/api/classes/${params.classId}`);
      if (response.ok) {
        const data = await response.json();
        setClassData(data);
      } else {
        console.error("Failed to fetch class data");
        router.push("/");
      }
    } catch (error) {
      console.error("Error fetching class data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      fetchClassData();
    }
  }, [status, params.classId, router]);

  const removeStudent = async (studentId: string) => {
    if (!confirm("Weet je zeker dat je deze student uit de klas wilt verwijderen?")) {
      return;
    }

    setRemovingStudentId(studentId);
    try {
      const response = await fetch(
        `/api/classes/${params.classId}/students/${studentId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Verwijder de student uit de lokale state
        setClassData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            students: prev.students.filter((s) => s.id !== studentId),
          };
        });
      } else {
        const data = await response.json();
        alert(`Fout: ${data.error || "Kon student niet verwijderen"}`);
      }
    } catch (error) {
      console.error("Error removing student:", error);
      alert("Er is een fout opgetreden bij het verwijderen van de student");
    } finally {
      setRemovingStudentId(null);
    }
  };

  const handleRequest = async (requestId: string, action: "accept" | "reject") => {
    setProcessingRequestId(requestId);
    try {
      const response = await fetch(
        `/api/classes/${params.classId}/requests/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );

      if (response.ok) {
        // Refresh class data
        await fetchClassData();
      } else {
        const data = await response.json();
        alert(`Fout: ${data.error || "Kon aanvraag niet verwerken"}`);
      }
    } catch (error) {
      console.error("Error processing request:", error);
      alert("Er is een fout opgetreden bij het verwerken van de aanvraag");
    } finally {
      setProcessingRequestId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Klas niet gevonden</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Terug naar dashboard
          </button>
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {classData.name}
            </h1>
            {classData.description && (
              <p className="text-gray-600 mb-4">{classData.description}</p>
            )}
          </div>
        </div>

        {/* Studenten lijst */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Studenten ({classData.students.length})
            </h2>
          </div>
          
          {classData.students.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">
                Nog geen studenten in deze klas.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {classData.students.map((student) => (
                <div
                  key={student.id}
                  className="px-6 py-4 flex items-center space-x-4 hover:bg-gray-50"
                >
                  {student.image ? (
                    <img
                      src={student.image}
                      alt={student.name || "Student"}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-lg">
                        {student.name?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {student.name || "Geen naam"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {student.email || "Geen email"}
                    </p>
                  </div>
                  <button
                    onClick={() => removeStudent(student.id)}
                    disabled={removingStudentId === student.id}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {removingStudentId === student.id
                      ? "Verwijderen..."
                      : "Verwijder"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Requests - Alleen voor docenten */}
        {session?.user?.id === classData.teacherId && classData.requests && classData.requests.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Openstaande Aanvragen ({classData.requests.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {classData.requests.map((request) => (
                <div
                  key={request.id}
                  className="px-6 py-4 flex items-center space-x-4 hover:bg-gray-50"
                >
                  {request.user.image ? (
                    <img
                      src={request.user.image}
                      alt={request.user.name || "Student"}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-lg">
                        {request.user.name?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {request.user.name || "Geen naam"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {request.user.email || "Geen email"}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleRequest(request.id, "accept")}
                      disabled={processingRequestId === request.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingRequestId === request.id ? "Bezig..." : "Accepteren"}
                    </button>
                    <button
                      onClick={() => handleRequest(request.id, "reject")}
                      disabled={processingRequestId === request.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingRequestId === request.id ? "Bezig..." : "Afwijzen"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teams sectie */}
        {classData.teams.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Teams ({classData.teams.length})
              </h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classData.teams.map((team) => (
                  <div
                    key={team.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors"
                  >
                    <h3 className="font-semibold text-gray-900">{team.name}</h3>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
