"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

type Student = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type Class = {
  id: string;
  name: string;
  description: string | null;
  students: Student[];
  teams: Array<{ id: string; name: string }>;
  classRequests: Array<{ id: string; user: { id: string; name: string | null; email: string | null; image: string | null } }>;
};

export default function ClassesPage() {
  const { data: session, status } = useSession();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editedClassName, setEditedClassName] = useState("");

  const selectedClass = classes.find(c => c.id === selectedClassId);

  useEffect(() => {
    if (session) {
      fetchClasses();
    }
  }, [session]);

  useEffect(() => {
    if (selectedClass) {
      setEditedClassName(selectedClass.name);
    }
  }, [selectedClass]);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        if (data.length > 0 && !selectedClassId) {
          setSelectedClassId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClassName,
          description: newClassDescription,
        }),
      });

      if (response.ok) {
        const newClass = await response.json();
        setClasses([newClass, ...classes]);
        setSelectedClassId(newClass.id);
        setShowNewClassModal(false);
        setNewClassName("");
        setNewClassDescription("");
      } else {
        const errorData = await response.json();
        alert("Fout bij aanmaken van klas: " + (errorData.error || "Onbekende fout"));
      }
    } catch (error) {
      console.error("Error creating class:", error);
      alert("Fout bij aanmaken van klas");
    }
  };

  const updateClassName = async () => {
    if (!selectedClass || editedClassName.trim() === "" || editedClassName === selectedClass.name) {
      setEditingName(false);
      return;
    }

    try {
      const response = await fetch(`/api/classes/${selectedClass.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedClassName }),
      });

      if (response.ok) {
        setClasses(classes.map(c => c.id === selectedClass.id ? { ...c, name: editedClassName } : c));
        setEditingName(false);
      } else {
        alert("Fout bij wijzigen van klasnaam");
      }
    } catch (error) {
      console.error("Error updating class name:", error);
      alert("Fout bij wijzigen van klasnaam");
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!selectedClass) return;
    if (!confirm("Weet je zeker dat je deze student uit de klas wilt verwijderen?")) return;

    try {
      const response = await fetch(`/api/classes/${selectedClass.id}/students/${studentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setClasses(classes.map(c => c.id === selectedClass.id 
          ? { ...c, students: c.students.filter(s => s.id !== studentId) } 
          : c
        ));
      } else {
        alert("Fout bij verwijderen van student");
      }
    } catch (error) {
      console.error("Error removing student:", error);
      alert("Fout bij verwijderen van student");
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!selectedClass) return;

    try {
      const response = await fetch(`/api/classes/${selectedClass.id}/requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (response.ok) {
        fetchClasses();
      } else {
        alert("Fout bij goedkeuren van aanvraag");
      }
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Fout bij goedkeuren van aanvraag");
    }
  };

  const rejectRequest = async (requestId: string) => {
    if (!selectedClass) return;

    try {
      const response = await fetch(`/api/classes/${selectedClass.id}/requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (response.ok) {
        fetchClasses();
      } else {
        alert("Fout bij afwijzen van aanvraag");
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Fout bij afwijzen van aanvraag");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Laden...</div>
      </div>
    );
  }

  if (session?.user?.role !== "teacher") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-600">Geen toegang</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white">ScrumFlow</Link>
            <span className="text-gray-400">|</span>
            <span className="text-lg text-gray-600 dark:text-gray-400">Klassen beheren</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
              ← Terug naar dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left sidebar - Classes list */}
        <aside className="w-72 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Klassen</h2>
              <button 
                onClick={() => setShowNewClassModal(true)} 
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700"
              >
                + Nieuw
              </button>
            </div>
            
            {classes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen klassen</p>
            ) : (
              <div className="space-y-2">
                {classes.map((classItem) => (
                  <button
                    key={classItem.id}
                    onClick={() => setSelectedClassId(classItem.id)}
                    className={`w-full rounded-lg p-3 text-left transition-colors ${
                      selectedClassId === classItem.id
                        ? "bg-indigo-100 dark:bg-indigo-900"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${selectedClassId === classItem.id ? "text-indigo-700 dark:text-indigo-300" : "text-gray-900 dark:text-white"}`}>
                        {classItem.name}
                      </span>
                      {classItem.classRequests && classItem.classRequests.length > 0 && (
                        <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
                          {classItem.classRequests.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {classItem.students.length} student(en) · {classItem.teams.length} team(s)
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right content - Class details */}
        <main className="flex-1 p-6">
          {selectedClass ? (
            <div className="space-y-6">
              {/* Class name header with edit */}
              <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedClassName}
                        onChange={(e) => setEditedClassName(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-xl font-bold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") updateClassName();
                          if (e.key === "Escape") { setEditingName(false); setEditedClassName(selectedClass.name); }
                        }}
                      />
                      <button onClick={updateClassName} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700">Opslaan</button>
                      <button onClick={() => { setEditingName(false); setEditedClassName(selectedClass.name); }} className="rounded-lg bg-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200">Annuleren</button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClass.name}</h1>
                      <button onClick={() => setEditingName(true)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Pending requests */}
              {selectedClass.classRequests && selectedClass.classRequests.length > 0 && (
                <div className="rounded-lg bg-orange-50 p-4 shadow dark:bg-orange-900/20">
                  <h2 className="mb-3 text-lg font-semibold text-orange-800 dark:text-orange-300">
                    Aanvragen ({selectedClass.classRequests.length})
                  </h2>
                  <div className="space-y-2">
                    {selectedClass.classRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                          {request.user.image ? (
                            <Image src={request.user.image} alt={request.user.name || "Student"} width={40} height={40} className="rounded-full" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600">
                              {request.user.name?.charAt(0) || "?"}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{request.user.name || "Onbekend"}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{request.user.email}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approveRequest(request.id)} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700">Goedkeuren</button>
                          <button onClick={() => rejectRequest(request.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">Afwijzen</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Students list */}
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Studenten ({selectedClass.students.length})
                </h2>
                {selectedClass.students.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">Nog geen studenten in deze klas</p>
                ) : (
                  <div className="space-y-2">
                    {selectedClass.students.map((student) => (
                      <div key={student.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                        <div className="flex items-center gap-3">
                          {student.image ? (
                            <Image src={student.image} alt={student.name || "Student"} width={40} height={40} className="rounded-full" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600">
                              {student.name?.charAt(0) || "?"}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{student.name || "Onbekend"}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{student.email}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeStudent(student.id)} 
                          className="rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                        >
                          Verwijderen
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">Selecteer een klas om te beheren</p>
            </div>
          )}
        </main>
      </div>

      {/* Modal voor nieuwe klas */}
      {showNewClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Nieuwe Klas Aanmaken</h2>
            <form onSubmit={createClass} className="space-y-4">
              <div>
                <label htmlFor="className" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Klasnaam</label>
                <input type="text" id="className" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="bijv. SD2A" required />
              </div>
              <div>
                <label htmlFor="classDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Beschrijving (optioneel)</label>
                <textarea id="classDescription" value={newClassDescription} onChange={(e) => setNewClassDescription(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="Beschrijving van de klas" rows={3} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowNewClassModal(false); setNewClassName(""); setNewClassDescription(""); }} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Annuleren</button>
                <button type="submit" className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Aanmaken</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
