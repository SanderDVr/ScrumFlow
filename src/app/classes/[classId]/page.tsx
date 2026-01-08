"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface GitHubIssue {
  id: string;
  issueNumber: number;
  title: string;
  body: string | null;
  state: string;
  htmlUrl: string;
  status: string;
  sprintName?: string;
  teamName?: string;
  projectName?: string;
}

interface Sprint {
  id: string;
  name: string;
  status: string;
  teamName: string;
  projectName: string;
}

interface StudentWithIssues {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  sprints: Sprint[];
  issues: GitHubIssue[];
  teamMemberships: Array<{
    teamId: string;
    teamName: string;
    role: string;
  }>;
}

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
  const [studentsWithIssues, setStudentsWithIssues] = useState<StudentWithIssues[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [availableSprints, setAvailableSprints] = useState<Sprint[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [showIssuesView, setShowIssuesView] = useState(false);

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

  const fetchStudentIssues = async (sprintId?: string) => {
    setLoadingIssues(true);
    try {
      const url = sprintId
        ? `/api/classes/${params.classId}/students-issues?sprintId=${sprintId}`
        : `/api/classes/${params.classId}/students-issues`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStudentsWithIssues(data.students);
        
        // Collect all available sprints
        const allSprints: Sprint[] = [];
        data.students.forEach((student: StudentWithIssues) => {
          student.sprints.forEach((sprint) => {
            if (!allSprints.find(s => s.id === sprint.id)) {
              allSprints.push(sprint);
            }
          });
        });
        setAvailableSprints(allSprints);
      } else {
        console.error("Failed to fetch student issues");
      }
    } catch (error) {
      console.error("Error fetching student issues:", error);
    } finally {
      setLoadingIssues(false);
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

  useEffect(() => {
    if (showIssuesView && status === "authenticated") {
      fetchStudentIssues(selectedSprintId || undefined);
    }
  }, [showIssuesView, selectedSprintId, status]);

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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {classData.name}
                </h1>
                {classData.description && (
                  <p className="text-gray-600 mb-4">{classData.description}</p>
                )}
              </div>
              <button
                onClick={() => setShowIssuesView(!showIssuesView)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {showIssuesView ? "Toon Studenten" : "Toon Issues"}
              </button>
            </div>
          </div>
        </div>

        {/* Student Issues View */}
        {showIssuesView && (
          <div className="mb-8">
            {/* Sprint Filter */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Filter op Sprint:
                </label>
                <select
                  value={selectedSprintId || "all"}
                  onChange={(e) => setSelectedSprintId(e.target.value === "all" ? null : e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Alle actieve sprints</option>
                  {availableSprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name} - {sprint.teamName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students with Issues */}
            {loadingIssues ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-600">Issues laden...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {studentsWithIssues.map((student) => (
                  <div key={student.id} className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                      <div className="flex items-center space-x-4">
                        {student.image ? (
                          <img
                            src={student.image}
                            alt={student.name || "Student"}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-gray-600 font-semibold">
                              {student.name?.[0]?.toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {student.name || "Geen naam"}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>{student.email}</span>
                            {student.teamMemberships.length > 0 && (
                              <span>•</span>
                            )}
                            {student.teamMemberships.map((membership, idx) => (
                              <span key={membership.teamId}>
                                {membership.teamName} ({membership.role})
                                {idx < student.teamMemberships.length - 1 && ", "}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {student.issues.length}
                          </div>
                          <div className="text-xs text-gray-500">
                            {student.issues.length === 1 ? "issue" : "issues"}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Issues List */}
                    <div className="px-6 py-4">
                      {student.issues.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                          Geen issues toegewezen voor deze sprint
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {student.issues.map((issue) => (
                            <div
                              key={issue.id}
                              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-mono text-gray-500">
                                      #{issue.issueNumber}
                                    </span>
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        issue.status === "done"
                                          ? "bg-green-100 text-green-800"
                                          : issue.status === "in_progress"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {issue.status === "done"
                                        ? "Done"
                                        : issue.status === "in_progress"
                                        ? "In Progress"
                                        : "To Do"}
                                    </span>
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        issue.state === "open"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {issue.state}
                                    </span>
                                  </div>
                                  <h4 className="font-medium text-gray-900 mb-1">
                                    {issue.title}
                                  </h4>
                                  {issue.body && (
                                    <p className="text-sm text-gray-600 line-clamp-2">
                                      {issue.body}
                                    </p>
                                  )}
                                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                    {issue.sprintName && (
                                      <span>Sprint: {issue.sprintName}</span>
                                    )}
                                    {issue.projectName && (
                                      <span>• Project: {issue.projectName}</span>
                                    )}
                                  </div>
                                </div>
                                <a
                                  href={issue.htmlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm whitespace-nowrap"
                                >
                                  View on GitHub
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {studentsWithIssues.length === 0 && (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <p className="text-gray-500">
                      Geen studenten met issues gevonden voor de geselecteerde sprint.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
