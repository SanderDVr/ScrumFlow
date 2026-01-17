"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

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

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: string;
  project: {
    id: string;
    name: string;
    repositoryUrl?: string | null;
    repositoryOwner?: string | null;
    repositoryName?: string | null;
    team?: {
      id: string;
      name: string;
      class?: {
        id: string;
        name: string;
      };
    };
  };
};

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

export default function Home() {
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  const [sprints, setSprints] = useState<Sprint[]>([]);
  
  // Student sprint view state
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [standups, setStandups] = useState<Standup[]>([]);
  const [retrospectives, setRetrospectives] = useState<Retrospective[]>([]);
  const [activeTab, setActiveTab] = useState<"board" | "standup" | "retro">("board");
  
  // Forms
  const [showStandupForm, setShowStandupForm] = useState(false);
  const [standupYesterday, setStandupYesterday] = useState("");
  const [standupToday, setStandupToday] = useState("");
  const [standupBlockers, setStandupBlockers] = useState("");
  const [showRetroForm, setShowRetroForm] = useState(false);
  const [retroWentWell, setRetroWentWell] = useState("");
  const [retroCanImprove, setRetroCanImprove] = useState("");
  const [retroActions, setRetroActions] = useState("");
  const [showRepoForm, setShowRepoForm] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  // When sprints are loaded, select the active one
  useEffect(() => {
    if (sprints.length > 0 && !selectedSprintId) {
      const today = new Date();
      const activeSprint = sprints.find(sprint => {
        const startDate = new Date(sprint.startDate);
        const endDate = new Date(sprint.endDate);
        return today >= startDate && today <= endDate;
      });
      setSelectedSprintId(activeSprint?.id || sprints[0].id);
    }
  }, [sprints, selectedSprintId]);

  // Fetch sprint data when selected sprint changes
  useEffect(() => {
    if (selectedSprintId && session?.user?.role === "student") {
      fetchSprintData(selectedSprintId);
    }
  }, [selectedSprintId, session]);

  const fetchData = async () => {
    try {
      const [teamsRes, userRes, classesRes, sprintsRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/user"),
        fetch("/api/classes"),
        fetch("/api/sprints"),
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

      if (sprintsRes.ok) {
        const sprintsData = await sprintsRes.json();
        setSprints(sprintsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSprintData = async (sprintId: string) => {
    try {
      const [issuesRes, standupsRes, retrosRes] = await Promise.all([
        fetch(`/api/sprints/${sprintId}/issues`),
        fetch(`/api/sprints/${sprintId}/standups`),
        fetch(`/api/sprints/${sprintId}/retrospectives`),
      ]);

      if (issuesRes.ok) {
        const data = await issuesRes.json();
        setIssues(data.sprintIssues || []);
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
    }
  };

  const moveIssue = async (issueId: string, newStatus: string) => {
    if (!selectedSprintId) return;
    try {
      const response = await fetch(`/api/sprints/${selectedSprintId}/issues`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, status: newStatus }),
      });

      if (response.ok) {
        fetchSprintData(selectedSprintId);
      }
    } catch (error) {
      console.error("Error moving issue:", error);
    }
  };

  const submitStandup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSprintId) return;

    try {
      const response = await fetch(`/api/sprints/${selectedSprintId}/standups`, {
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
        fetchSprintData(selectedSprintId);
      }
    } catch (error) {
      console.error("Error submitting standup:", error);
    }
  };

  const submitRetro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSprintId) return;

    try {
      const response = await fetch(`/api/sprints/${selectedSprintId}/retrospectives`, {
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
        fetchSprintData(selectedSprintId);
      }
    } catch (error) {
      console.error("Error submitting retrospective:", error);
    }
  };

  const linkRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedSprint = sprints.find(s => s.id === selectedSprintId);
    if (!selectedSprint?.project.team?.id) return;

    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(urlPattern);

    if (!match) {
      alert("Ongeldige GitHub URL. Gebruik format: https://github.com/owner/repo");
      return;
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");

    try {
      const response = await fetch(`/api/teams/${selectedSprint.project.team.id}/repository`, {
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
        fetchData();
        if (selectedSprintId) fetchSprintData(selectedSprintId);
      } else {
        const error = await response.json();
        alert("Fout: " + (error.error || "Kon repository niet koppelen"));
      }
    } catch (error) {
      console.error("Error linking repository:", error);
      alert("Fout bij koppelen repository");
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
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white">ScrumFlow</h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">Beheer je Scrum projecten met gemak</p>
        </div>
        <button onClick={() => signIn("github")} className="rounded-lg bg-gray-900 px-6 py-3 text-white hover:bg-gray-800">
          Inloggen met GitHub
        </button>
      </div>
    );
  }

  // STUDENT VIEW - Sprint Board
  if (session.user?.role === "student") {
    const selectedSprint = sprints.find(s => s.id === selectedSprintId);
    const todoIssues = issues.filter((i) => i.status === "todo");
    const inProgressIssues = issues.filter((i) => i.status === "in_progress");
    const doneIssues = issues.filter((i) => i.status === "done");

    // No class yet
    if (!userData?.classId) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ScrumFlow</h1>
              <div className="flex items-center gap-4">
                {session.user?.image && <Image src={session.user.image} alt={session.user.name || "User"} width={40} height={40} className="rounded-full" />}
                <button onClick={() => signOut()} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Uitloggen</button>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8">
            <div className="rounded-lg bg-yellow-50 border-2 border-yellow-200 p-8 text-center dark:bg-yellow-900/20 dark:border-yellow-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Je bent nog niet toegevoegd aan een klas</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Om te kunnen werken met sprints, moet je eerst lid worden van een klas.</p>
              <Link href="/join-class" className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700">Kies een klas</Link>
            </div>
          </main>
        </div>
      );
    }

    // No team yet
    if (teams.length === 0) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ScrumFlow</h1>
              <div className="flex items-center gap-4">
                {session.user?.image && <Image src={session.user.image} alt={session.user.name || "User"} width={40} height={40} className="rounded-full" />}
                <button onClick={() => signOut()} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Uitloggen</button>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8">
            <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nog geen team</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Je bent nog niet toegevoegd aan een team. Vraag je docent om je aan een team toe te voegen.</p>
            </div>
          </main>
        </div>
      );
    }

    // No sprints yet
    if (sprints.length === 0) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ScrumFlow</h1>
              <div className="flex items-center gap-4">
                {session.user?.image && <Image src={session.user.image} alt={session.user.name || "User"} width={40} height={40} className="rounded-full" />}
                <button onClick={() => signOut()} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Uitloggen</button>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8">
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-600 dark:bg-gray-800/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Geen sprints</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Je docent heeft nog geen sprints aangemaakt voor je team.</p>
            </div>
          </main>
        </div>
      );
    }

    // Main student sprint view
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ScrumFlow</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {session.user?.image && <Image src={session.user.image} alt={session.user.name || "User"} width={40} height={40} className="rounded-full" />}
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">{session.user?.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{teams[0]?.name}</div>
                  </div>
                </div>
                <button onClick={() => signOut()} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">Uitloggen</button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto max-w-7xl px-4">
            <nav className="flex space-x-8 overflow-x-auto">
              {/* Sprints */}
              {sprints.map((sprint) => {
                const today = new Date();
                const startDate = new Date(sprint.startDate);
                const endDate = new Date(sprint.endDate);
                const isActive = today >= startDate && today <= endDate;
                const isSelected = selectedSprintId === sprint.id && activeTab === "board";
                return (
                  <button
                    key={sprint.id}
                    onClick={() => { setSelectedSprintId(sprint.id); setActiveTab("board"); }}
                    className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${isSelected ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"}`}
                  >
                    {sprint.name}
                    {isActive && <span className="ml-1 text-xs text-green-600 dark:text-green-400">●</span>}
                  </button>
                );
              })}
              
              {/* Divider */}
              <div className="border-l border-gray-300 dark:border-gray-600 my-2" />
              
              {/* Backlog */}
              {teams[0]?.class?.id && (
                <Link
                  href={`/classes/${teams[0].class.id}/backlog`}
                  className="whitespace-nowrap border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
                >
                  📋 Backlog
                </Link>
              )}
              
            </nav>
          </div>
        </div>

        {/* Repository Section */}
        <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-3">
            {selectedSprint?.project.repositoryUrl ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Repository:</span>
                  <a href={selectedSprint.project.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    {selectedSprint.project.repositoryOwner}/{selectedSprint.project.repositoryName}
                  </a>
                </div>
                <button onClick={() => setShowRepoForm(true)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">Wijzigen</button>
              </div>
            ) : (
              <button onClick={() => setShowRepoForm(true)} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                + GitHub Repository Koppelen
              </button>
            )}
          </div>
        </div>

        {/* Repository Form Modal */}
        {showRepoForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">GitHub Repository Koppelen</h3>
              <form onSubmit={linkRepository}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub Repository URL</label>
                  <input type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Koppelen</button>
                  <button type="button" onClick={() => setShowRepoForm(false)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Annuleren</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex gap-6">
            {/* Left Sidebar - Daily Stand-up & Retrospective Buttons */}
            {(() => {
              const today = new Date();
              const sprintStart = selectedSprint ? new Date(selectedSprint.startDate) : null;
              const sprintEnd = selectedSprint ? new Date(selectedSprint.endDate) : null;
              const isActiveOrFinished = sprintStart && sprintEnd && today >= sprintStart;
              
              return (
                <div className="w-48 shrink-0 space-y-3">
                  {/* Sprint Dates */}
                  {selectedSprint && (
                    <div className="rounded-lg bg-white p-3 shadow dark:bg-gray-800">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sprint periode</div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(selectedSprint.startDate).toLocaleDateString('nl-NL')} - {new Date(selectedSprint.endDate).toLocaleDateString('nl-NL')}
                      </div>
                      {sprintStart && sprintEnd && (
                        <div className="mt-1 text-xs">
                          {today < sprintStart ? (
                            <span className="text-blue-600 dark:text-blue-400">Gepland</span>
                          ) : today > sprintEnd ? (
                            <span className="text-gray-500 dark:text-gray-400">Afgerond</span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">Actief</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Show buttons only for active or finished sprints */}
                  {isActiveOrFinished && (
                    <>
                      <button
                        onClick={() => setActiveTab("standup")}
                        className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === "standup" ? "bg-blue-600 text-white" : "bg-white text-gray-700 shadow hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"}`}
                      >
                        📝 Daily Stand-up
                      </button>
                      <button
                        onClick={() => setActiveTab("retro")}
                        className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === "retro" ? "bg-blue-600 text-white" : "bg-white text-gray-700 shadow hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"}`}
                      >
                        🔄 Retrospective
                      </button>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Main Content */}
            <div className="flex-1">
              {activeTab === "board" && (
            <div className="grid gap-4 md:grid-cols-3">
              {/* To Do */}
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <h3 className="mb-4 flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white">
                  <span>To Do</span>
                  <span className="rounded-full bg-gray-200 px-2 py-1 text-xs dark:bg-gray-700">{todoIssues.length}</span>
                </h3>
                <div className="space-y-3">
                  {todoIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onMove={moveIssue} />)}
                  {todoIssues.length === 0 && <p className="text-center text-sm text-gray-500 dark:text-gray-400">Geen issues</p>}
                </div>
              </div>

              {/* Doing */}
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <h3 className="mb-4 flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white">
                  <span>Doing</span>
                  <span className="rounded-full bg-blue-200 px-2 py-1 text-xs dark:bg-blue-700">{inProgressIssues.length}</span>
                </h3>
                <div className="space-y-3">
                  {inProgressIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onMove={moveIssue} />)}
                  {inProgressIssues.length === 0 && <p className="text-center text-sm text-gray-500 dark:text-gray-400">Geen issues</p>}
                </div>
              </div>

              {/* Done */}
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <h3 className="mb-4 flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white">
                  <span>Done</span>
                  <span className="rounded-full bg-green-200 px-2 py-1 text-xs dark:bg-green-700">{doneIssues.length}</span>
                </h3>
                <div className="space-y-3">
                  {doneIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onMove={moveIssue} />)}
                  {doneIssues.length === 0 && <p className="text-center text-sm text-gray-500 dark:text-gray-400">Geen issues</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === "standup" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Daily Stand-ups</h2>
                <button onClick={() => setShowStandupForm(!showStandupForm)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                  {showStandupForm ? "Annuleren" : "+ Stand-up Toevoegen"}
                </button>
              </div>

              {showStandupForm && (
                <form onSubmit={submitStandup} className="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Nieuwe Stand-up</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Wat heb je gisteren gedaan? *</label>
                      <textarea value={standupYesterday} onChange={(e) => setStandupYesterday(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" rows={3} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Wat ga je vandaag doen? *</label>
                      <textarea value={standupToday} onChange={(e) => setStandupToday(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" rows={3} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Blokkades (optioneel)</label>
                      <textarea value={standupBlockers} onChange={(e) => setStandupBlockers(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" rows={2} />
                    </div>
                    <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Stand-up Opslaan</button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {standups.map((standup) => (
                  <div key={standup.id} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">{new Date(standup.date).toLocaleDateString()}</div>
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
                {standups.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">Nog geen stand-ups</p>}
              </div>
            </div>
          )}

          {activeTab === "retro" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Retrospective</h2>
                {!retrospectives.some((r) => r.userId === session.user?.id) && (
                  <button onClick={() => setShowRetroForm(!showRetroForm)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                    {showRetroForm ? "Annuleren" : "+ Retrospective Invullen"}
                  </button>
                )}
              </div>

              {showRetroForm && (
                <form onSubmit={submitRetro} className="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Nieuwe Retrospective</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Wat ging goed? *</label>
                      <textarea value={retroWentWell} onChange={(e) => setRetroWentWell(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" rows={3} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Wat kan beter? *</label>
                      <textarea value={retroCanImprove} onChange={(e) => setRetroCanImprove(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" rows={3} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Actiepunten (optioneel)</label>
                      <textarea value={retroActions} onChange={(e) => setRetroActions(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" rows={3} />
                    </div>
                    <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Retrospective Opslaan</button>
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
                {retrospectives.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">Nog geen retrospectives</p>}
              </div>
            </div>
          )}
            </div>
          </div>

          {/* Team Members Section */}
          <div className="mt-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Teamleden</h3>
            <div className="flex flex-wrap gap-4">
              {teams[0]?.members.map((member, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                  {member.user.image ? (
                    <Image src={member.user.image} alt={member.user.name || "Member"} width={40} height={40} className="rounded-full" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 text-sm font-medium dark:bg-gray-600">
                      {member.user.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">{member.user.name || "Onbekend"}</span>
                </div>
              ))}
              {(!teams[0]?.members || teams[0].members.length === 0) && (
                <p className="text-gray-500 dark:text-gray-400">Geen teamleden gevonden</p>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // TEACHER VIEW - Dashboard
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ScrumFlow</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {session.user?.image && <Image src={session.user.image} alt={session.user.name || "User"} width={40} height={40} className="rounded-full" />}
              <div className="text-sm">
                <div className="font-medium text-gray-900 dark:text-white">{session.user?.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Docent</div>
              </div>
            </div>
            <button onClick={() => signOut()} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Uitloggen</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Overzicht van je klassen en teams</p>
        </div>

        {loading ? (
          <div className="text-center"><div className="text-gray-600 dark:text-gray-400">Laden...</div></div>
        ) : (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Teams</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{teams.length}</p>
                  </div>
                  <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
                    <svg className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Klassen</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{classes.length}</p>
                  </div>
                  <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                    <svg className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Classes */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Klassen</h3>
                <button onClick={() => setShowNewClassModal(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Nieuwe klas aanmaken</button>
              </div>
              {classes.length === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
                  <p className="text-gray-600 dark:text-gray-400">Je hebt nog geen klassen. Maak je eerste klas aan!</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {classes.map((classItem) => (
                    <Link key={classItem.id} href={`/classes/${classItem.id}`} className="block rounded-lg bg-white p-6 shadow hover:shadow-lg dark:bg-gray-800">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{classItem.name}</h4>
                      {classItem.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{classItem.description}</p>}
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{classItem.students.length} student(en)</span>
                        <div className="flex items-center gap-2">
                          {classItem.classRequests && classItem.classRequests.length > 0 && (
                            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                              {classItem.classRequests.length} aanvra{classItem.classRequests.length === 1 ? 'ag' : 'gen'}
                            </span>
                          )}
                          <span className="text-gray-600 dark:text-gray-400">{classItem.teams.length} team(s)</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Teams */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Teams</h3>
                <Link href="/teams/new" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Nieuw team aanmaken</Link>
              </div>
              {teams.length === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
                  <p className="text-gray-600 dark:text-gray-400">Je hebt nog geen teams. Maak je eerste team aan!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(new Set(teams.map(t => t.class.id))).map((classId) => {
                    const classTeams = teams.filter(t => t.class.id === classId);
                    const className = classTeams[0]?.class.name;
                    return (
                      <div key={classId}>
                        <h4 className="mb-3 text-lg font-medium text-gray-700 dark:text-gray-300">{className}</h4>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {classTeams.map((team) => (
                            <Link key={team.id} href={`/teams/${team.id}`} className="block rounded-lg bg-white p-6 shadow hover:shadow-lg dark:bg-gray-800">
                              <h5 className="text-lg font-semibold text-gray-900 dark:text-white">{team.name}</h5>
                              {team.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{team.description}</p>}
                              <div className="mt-4 flex -space-x-2">
                                {team.members.slice(0, 3).map((member, i) => (
                                  <div key={i} className="h-8 w-8 overflow-hidden rounded-full border-2 border-white dark:border-gray-800">
                                    {member.user.image ? <Image src={member.user.image} alt={member.user.name || "Member"} width={32} height={32} /> : <div className="flex h-full w-full items-center justify-center bg-gray-300 text-xs dark:bg-gray-600">{member.user.name?.charAt(0) || "?"}</div>}
                                  </div>
                                ))}
                                {team.members.length > 3 && <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs dark:border-gray-800 dark:bg-gray-700">+{team.members.length - 3}</div>}
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
          </div>
        )}
      </main>

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

function IssueCard({ issue, onMove }: { issue: GitHubIssue; onMove: (issueId: string, status: string) => void }) {
  const labels = issue.labels ? JSON.parse(issue.labels) : [];
  const isClosed = issue.state === "closed" || issue.status === "done";
  
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <a href={issue.htmlUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
            #{issue.issueNumber} {issue.title}
          </a>
          {issue.body && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{issue.body}</p>}
          {labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {labels.slice(0, 3).map((label: any, idx: number) => (
                <span key={idx} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: `#${label.color}33`, color: `#${label.color}` }}>{label.name}</span>
              ))}
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${issue.state === "open" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"}`}>
          {issue.state}
        </span>
      </div>
      {!isClosed && (
        <div className="mt-3">
          <select value={issue.status} onChange={(e) => onMove(issue.id, e.target.value)} className="w-full text-xs rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="todo">To Do</option>
            <option value="in_progress">Doing</option>
          </select>
        </div>
      )}
    </div>
  );
}
