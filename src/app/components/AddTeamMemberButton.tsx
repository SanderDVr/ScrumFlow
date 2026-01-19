"use client";
import { useState, useEffect } from "react";

export default function AddTeamMemberButton({ viewingTeam }) {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!viewingTeam) return;
    fetch(`/api/classes/${viewingTeam.class.id}`)
      .then(res => res.json())
      .then(data => {
        const memberIds = new Set(viewingTeam.members.map(m => m.user.id));
        setStudents((data.students || []).filter(s => !memberIds.has(s.id)));
      });
  }, [viewingTeam]);

  const handleAdd = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${viewingTeam.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedStudentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Fout bij toevoegen: ${data.error || res.statusText}`);
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Kon teamlid niet toevoegen");
      setLoading(false);
    }
  };

  if (!viewingTeam) return null;
  return (
    <>
      <button
        onClick={() => setShow(s => !s)}
        className="ml-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
      >Lid toevoegen</button>
      {show && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="rounded border px-2 py-1"
          >
            <option value="">Selecteer student...</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name || s.email || s.id}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedStudentId || loading}
            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
          >Toevoegen</button>
        </div>
      )}
    </>
  );
}
