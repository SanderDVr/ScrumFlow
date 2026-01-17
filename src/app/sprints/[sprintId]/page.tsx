"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

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

type Sprint = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  project: {
    id: string;
    name: string;
    repositoryUrl: string | null;
    repositoryOwner: string | null;
    repositoryName: string | null;
    team: {
      id: string;
      name: string;
      class: {
        id: string;
        name: string;
      };
    };
  };
};

type Standup = {
  id: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  userId: string;
};

type Retrospective = {
  id: string;
  whatWentWell: string;
  whatCanImprove: string;
  actionItems: string | null;
  userId: string;
};

export default function SprintPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const sprintId = params?.sprintId as string;

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [backlogIssues, setBacklogIssues] = useState<GitHubIssue[]>([]);
  const [standups, setStandups] = useState<Standup[]>([]);
  const [retrospectives, setRetrospectives] = useState<Retrospective[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"board" | "standup" | "retro">("board");
  const [showBacklog, setShowBacklog] = useState(false);

  // Standup form
  const [showStandupForm, setShowStandupForm] = useState(false);
  const [standupYesterday, setStandupYesterday] = useState("");
  const [standupToday, setStandupToday] = useState("");
  const [standupBlockers, setStandupBlockers] = useState("");

  // Retro form
  const [showRetroForm, setShowRetroForm] = useState(false);
  const [retroWentWell, setRetroWentWell] = useState("");
  const [retroCanImprove, setRetroCanImprove] = useState("");
  const [retroActions, setRetroActions] = useState("");

  // Repository form
  const [showRepoForm, setShowRepoForm] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");

  useEffect(() => {
    if (session && sprintId) {
      fetchSprintData();
    }
  }, [session, sprintId]);

  const fetchSprintData = async () => {
    try {
      const [sprintRes, issuesRes, standupsRes, retrosRes] = await Promise.all([
        fetch(`/api/sprints/${sprintId}`),
        fetch(`/api/sprints/${sprintId}/issues`),
        fetch(`/api/sprints/${sprintId}/standups`),
        fetch(`/api/sprints/${sprintId}/retrospectives`),
      ]);

      if (sprintRes.ok) {
        const data = await sprintRes.json();
        setSprint(data);
      }

      if (issuesRes.ok) {
        const data = await issuesRes.json();
        setIssues(data.sprintIssues || []);
        setBacklogIssues(data.backlogIssues || []);
      }

      if (standupsRes.ok) {
        const data = await standupsRes.json();
        setStandups(data);
      }

      if (retrosRes.ok) {
        const data = await retrosRes.json();
        setRetrospectives(data);
      }
    } catch (error) {
      console.error("Error fetching sprint data:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitStandup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/sprints/${sprintId}/standups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yesterday: standupYesterday,
          today: standupToday,
          blockers: standupBlockers || null,
        }),
      });

      if (response.ok) {
        setShowStandupForm(false);
        setStandupYesterday("");
        setStandupToday("");
        setStandupBlockers("");
        fetchSprintData();
      }
    } catch (error) {
      console.error("Error submitting standup:", error);
    }
  };

  const submitRetro = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/sprints/${sprintId}/retrospectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatWentWell: retroWentWell,
          whatCanImprove: retroCanImprove,
          actionItems: retroActions || null,
        }),
      });

      if (response.ok) {
        setShowRetroForm(false);
        setRetroWentWell("");
        setRetroCanImprove("");
        setRetroActions("");
        fetchSprintData();
      }
    } catch (error) {
      console.error("Error submitting retrospective:", error);
    }
  };

  const moveIssue = async (issueId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/sprints/${sprintId}/issues`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, status: newStatus }),
      });

      if (response.ok) {
        fetchSprintData();
      }
    } catch (error) {
      console.error("Error moving issue:", error);
    }
  };

  const assignIssueToSprint = async (issueId: string) => {
    try {
      const response = await fetch(`/api/sprints/${sprintId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });

      if (response.ok) {
        fetchSprintData();
      }
    } catch (error) {
      console.error("Error assigning issue:", error);
    }
  };

  const linkRepository = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse GitHub URL
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(urlPattern);

    if (!match) {
      alert("Ongeldige GitHub URL. Gebruik format: https://github.com/owner/repo");
      return;
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");

    try {
      const response = await fetch(`/api/teams/${sprint?.project.team.id}/repository`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryUrl: repoUrl,
          repositoryOwner: owner,
          repositoryName: cleanRepo,
        }),
      });

      if (response.ok) {
        setShowRepoForm(false);
        setRepoUrl("");
        fetchSprintData();
      } else {
        const error = await response.json();
        alert("Fout: " + (error.error || "Kon repository niet koppelen"));
      }
    } catch (error) {
      console.error("Error linking repository:", error);
      alert("Fout bij koppelen repository");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Laden...</div>
      </div>
    );
  }

  if (!session || !sprint) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Sprint niet gevonden</div>
      </div>
    );
  }

  const todoIssues = issues.filter((i) => i.status === "todo");
  const inProgressIssues = issues.filter((i) => i.status === "in_progress");
  const doneIssues = issues.filter((i) => i.status === "done");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href="/" 
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Terug naar sprint overzicht
              </Link>
              <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {sprint.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {sprint.project.team.name} • {sprint.project.team.class.name}
              </p>
              <Link
                href={`/classes/${sprint.project.team.class.id}/backlog`}
                className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 border border-blue-600 rounded px-2 py-1"
              >
                📋 Naar Backlog (GitHub Issues)
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                </div>
                <div className="mt-1">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      sprint.status === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        : sprint.status === "completed"
                        ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                    }`}
                  >
                    {sprint.status === "active" ? "Actief" : sprint.status === "completed" ? "Afgerond" : "Gepland"}
                  </span>
                </div>
              </div>
              {session?.user?.image && (
                <div className="flex items-center gap-3">
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <button
                    onClick={() => router.push('/api/auth/signout')}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                  >
                    Uitloggen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Repository Section */}
      {session?.user?.role === "student" && (
        <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-3">
            {sprint.project.repositoryUrl ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Repository:</span>
                  <a 
                    href={sprint.project.repositoryUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {sprint.project.repositoryOwner}/{sprint.project.repositoryName}
                  </a>
                </div>
                <button
                  onClick={() => setShowRepoForm(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  Wijzigen
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRepoForm(true)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                + GitHub Repository Koppelen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Repository Form Modal */}
      {showRepoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              GitHub Repository Koppelen
            </h3>
            <form onSubmit={linkRepository}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Bijvoorbeeld: https://github.com/username/repository
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  Koppelen
                </button>
                <button
                  type="button"
                  onClick={() => setShowRepoForm(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("board")}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === "board"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              Sprint Board
            </button>
            <button
              onClick={() => setActiveTab("standup")}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === "standup"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              Daily Stand-ups
            </button>
            <button
              onClick={() => setActiveTab("retro")}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === "retro"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              Retrospective
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {activeTab === "board" && (
          <div>
            {/* Backlog issues section removed as requested. Only the link to the backlog remains above. */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* To Do */}
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <h3 className="mb-4 flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white">
                  <span>To Do</span>
                  <span className="rounded-full bg-gray-200 px-2 py-1 text-xs dark:bg-gray-700">
                    {todoIssues.length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {todoIssues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} onMove={moveIssue} />
                  ))}
                  {todoIssues.length === 0 && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                      Geen issues
                    </p>
                  )}
                </div>
              </div>

              {/* Doing */}
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <h3 className="mb-4 flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white">
                  <span>Doing</span>
                  <span className="rounded-full bg-blue-200 px-2 py-1 text-xs dark:bg-blue-700">
                    {inProgressIssues.length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {inProgressIssues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} onMove={moveIssue} />
                  ))}
                  {inProgressIssues.length === 0 && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                      Geen issues
                    </p>
                  )}
                </div>
              </div>

              {/* Done */}
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <h3 className="mb-4 flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white">
                  <span>Done</span>
                  <span className="rounded-full bg-green-200 px-2 py-1 text-xs dark:bg-green-700">
                    {doneIssues.length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {doneIssues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} onMove={moveIssue} />
                  ))}
                  {doneIssues.length === 0 && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                      Geen issues
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "standup" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Daily Stand-ups
              </h2>
              <button
                onClick={() => setShowStandupForm(!showStandupForm)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
              >
                {showStandupForm ? "Annuleren" : "+ Stand-up Toevoegen"}
              </button>
            </div>

            {showStandupForm && (
              <form onSubmit={submitStandup} className="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Nieuwe Stand-up
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Wat heb je gisteren gedaan? *
                    </label>
                    <textarea
                      value={standupYesterday}
                      onChange={(e) => setStandupYesterday(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Wat ga je vandaag doen? *
                    </label>
                    <textarea
                      value={standupToday}
                      onChange={(e) => setStandupToday(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Blokkades (optioneel)
                    </label>
                    <textarea
                      value={standupBlockers}
                      onChange={(e) => setStandupBlockers(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows={2}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  >
                    Stand-up Opslaan
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {standups.map((standup) => (
                <div key={standup.id} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                  <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(standup.date).toLocaleDateString()}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Gisteren</h4>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{standup.yesterday}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Vandaag</h4>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{standup.today}</p>
                    </div>
                    {standup.blockers && (
                      <div>
                        <h4 className="font-medium text-red-600 dark:text-red-400">Blokkades</h4>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{standup.blockers}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {standups.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400">
                  Nog geen stand-ups
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "retro" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Retrospective
              </h2>
              {!retrospectives.some((r) => r.userId === session.user?.id) && (
                <button
                  onClick={() => setShowRetroForm(!showRetroForm)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                >
                  {showRetroForm ? "Annuleren" : "+ Retrospective Invullen"}
                </button>
              )}
            </div>

            {showRetroForm && (
              <form onSubmit={submitRetro} className="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Nieuwe Retrospective
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Wat ging goed? *
                    </label>
                    <textarea
                      value={retroWentWell}
                      onChange={(e) => setRetroWentWell(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Wat kan beter? *
                    </label>
                    <textarea
                      value={retroCanImprove}
                      onChange={(e) => setRetroCanImprove(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Actiepunten (optioneel)
                    </label>
                    <textarea
                      value={retroActions}
                      onChange={(e) => setRetroActions(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows={3}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  >
                    Retrospective Opslaan
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {retrospectives.map((retro) => (
                <div key={retro.id} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-green-600 dark:text-green-400">Wat ging goed</h4>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{retro.whatWentWell}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-orange-600 dark:text-orange-400">Wat kan beter</h4>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{retro.whatCanImprove}</p>
                    </div>
                    {retro.actionItems && (
                      <div>
                        <h4 className="font-medium text-blue-600 dark:text-blue-400">Actiepunten</h4>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{retro.actionItems}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {retrospectives.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400">
                  Nog geen retrospectives
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function IssueCard({
  issue,
  onMove,
}: {
  issue: GitHubIssue;
  onMove: (issueId: string, status: string) => void;
}) {
  const labels = issue.labels ? JSON.parse(issue.labels) : [];
  const isClosed = issue.state === "closed" || issue.status === "done";
  
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <a
            href={issue.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
          >
            #{issue.issueNumber} {issue.title}
          </a>
          {issue.body && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {issue.body}
            </p>
          )}
          {labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {labels.slice(0, 3).map((label: any, idx: number) => (
                <span
                  key={idx}
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: `#${label.color}33`,
                    color: `#${label.color}`,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs ${
            issue.state === "open"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
          }`}
        >
          {issue.state}
        </span>
      </div>
      {!isClosed && (
        <div className="mt-3">
          <select
            value={issue.status}
            onChange={(e) => onMove(issue.id, e.target.value)}
            className="w-full text-xs rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">Doing</option>
          </select>
        </div>
      )}
    </div>
  );
}
