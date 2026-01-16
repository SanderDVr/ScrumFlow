
"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";


type GitHubIssue = {
  id: string;
  issueNumber: number;
  title: string;
  body: string | null;
  state: string;
  htmlUrl: string;
  status: string;
  labels: string | null;
  assignees: string | null;
};

type Project = {
  id: string;
  repositoryOwner: string | null;
  repositoryName: string | null;
};

type Sprint = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
};

export default function BacklogPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const classId = params?.classId as string;

  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showNewIssueForm, setShowNewIssueForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editIssueId, setEditIssueId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [assigningIssueId, setAssigningIssueId] = useState<string | null>(null);

  useEffect(() => {
    if (session && classId) {
      fetchIssues();
    }
  }, [session, classId]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}/backlog?includeSprints=true`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
        setProjects(data.projects || []);
        setSprints(data.sprints || []);
      }
    } catch (error) {
      console.error("Error fetching backlog issues:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncFromGitHub = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/classes/${classId}/backlog?sync=true`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
        setProjects(data.projects || []);
        
        if (data.syncError) {
          alert(`Sync waarschuwing: ${data.syncError}`);
        }
      } else {
        alert('Sync mislukt. Probeer het later opnieuw.');
      }
    } catch (error) {
      console.error("Error syncing from GitHub:", error);
      alert('Sync mislukt. Controleer je internetverbinding.');
    } finally {
      setSyncing(false);
    }
  };

  const createIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/classes/${classId}/backlog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, body: newBody }),
      });
      if (res.ok) {
        setShowNewIssueForm(false);
        setNewTitle("");
        setNewBody("");
        fetchIssues();
      }
    } catch (error) {
      console.error("Error creating issue:", error);
    }
  };

  const startEditIssue = (issue: GitHubIssue) => {
    setEditIssueId(issue.id);
    setEditTitle(issue.title);
    setEditBody(issue.body || "");
  };

  const updateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editIssueId) return;
    try {
      const res = await fetch(`/api/classes/${classId}/backlog/${editIssueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      if (res.ok) {
        setEditIssueId(null);
        setEditTitle("");
        setEditBody("");
        fetchIssues();
      }
    } catch (error) {
      console.error("Error updating issue:", error);
    }
  };

  const deleteIssue = async (issueId: string) => {
    console.log('deleteIssue called with issueId:', issueId);
    console.log('classId:', classId);
    // Temporarily removed confirm dialog for testing
    try {
      console.log('Sending DELETE request to:', `/api/classes/${classId}/backlog/${issueId}`);
      const res = await fetch(`/api/classes/${classId}/backlog/${issueId}`, {
        method: "DELETE",
      });
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      
      if (res.ok) {
        if (data.warning) {
          alert(data.warning);
        }
        fetchIssues();
      } else {
        alert(`Fout bij verwijderen: ${data.error || 'Onbekende fout'}`);
      }
    } catch (error) {
      console.error("Error deleting issue:", error);
      alert("Er is een fout opgetreden bij het verwijderen van het issue.");
    }
  };

  const assignToSprint = async (issueId: string, sprintId: string) => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      if (res.ok) {
        setAssigningIssueId(null);
        fetchIssues();
      } else {
        const data = await res.json();
        alert(`Fout bij toewijzen: ${data.error || 'Onbekende fout'}`);
      }
    } catch (error) {
      console.error("Error assigning issue to sprint:", error);
      alert("Er is een fout opgetreden bij het toewijzen van het issue.");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Backlog - GitHub Issues</h1>
        <div className="mb-6 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewIssueForm(!showNewIssueForm)}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {showNewIssueForm ? "Annuleren" : "+ Nieuw Issue"}
            </button>
            {projects.some(p => p.repositoryOwner && p.repositoryName) && (
              <button
                onClick={syncFromGitHub}
                disabled={syncing}
                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
              >
                {syncing ? "Synchroniseren..." : "🔄 Sync van GitHub"}
              </button>
            )}
          </div>
        </div>
        {showNewIssueForm && (
          <form onSubmit={createIssue} className="mb-6 bg-white dark:bg-gray-800 p-4 rounded shadow">
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Titel *</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Omschrijving</label>
              <textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                rows={3}
              />
            </div>
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 mt-2">Aanmaken</button>
          </form>
        )}

        <div className="space-y-4">
          {issues.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400">Geen issues in de backlog.</p>
          )}
          {issues.map(issue => (
            <div key={issue.id} className="bg-white dark:bg-gray-800 p-4 rounded shadow flex flex-col gap-2">
              {editIssueId === issue.id ? (
                <form onSubmit={updateIssue} className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    required
                    className="block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    className="block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">Opslaan</button>
                    <button type="button" onClick={() => setEditIssueId(null)} className="rounded bg-gray-300 px-4 py-2 text-gray-800 hover:bg-gray-400">Annuleren</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">#{issue.issueNumber} {issue.title}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      {assigningIssueId === issue.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                assignToSprint(issue.id, e.target.value);
                              }
                            }}
                            className="text-xs rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            defaultValue=""
                          >
                            <option value="" disabled>Kies sprint...</option>
                            {sprints.filter(s => s.status !== 'completed').map(sprint => (
                              <option key={sprint.id} value={sprint.id}>
                                {sprint.name} ({sprint.status === 'active' ? 'Actief' : 'Gepland'})
                              </option>
                            ))}
                          </select>
                          <button 
                            onClick={() => setAssigningIssueId(null)} 
                            className="text-xs text-gray-500 hover:underline"
                          >
                            Annuleren
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setAssigningIssueId(issue.id)} 
                          className="text-xs text-purple-600 hover:underline"
                          title="Toewijzen aan sprint"
                        >
                          → Sprint
                        </button>
                      )}
                      <button onClick={() => startEditIssue(issue)} className="text-xs text-blue-600 hover:underline">Bewerken</button>
                      <button onClick={() => deleteIssue(issue.id)} className="text-xs text-red-600 hover:underline">Verwijderen</button>
                    </div>
                  </div>
                  {issue.body && <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{issue.body}</p>}
                  <a
                    href={issue.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-1"
                  >
                    Bekijk op GitHub
                  </a>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

