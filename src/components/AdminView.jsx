"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  orderBy,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getTodayString,
  formatDisplayDate,
  formatTime,
  compareTime,
  generateDayInstances,
  getAnalytics,
  DAY_NAMES,
  DAY_FULL,
} from "@/lib/scheduler";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

// ─── Frequency badge ──────────────────────────────────────────────────────────
function FreqBadge({ freq }) {
  const styles = {
    daily: "bg-blue-100 text-blue-700",
    weekly: "bg-purple-100 text-purple-700",
    monthly: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${styles[freq] || ""}`}>
      {freq}
    </span>
  );
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────
function TaskModal({ task, onClose, onSave }) {
  const isEdit = !!task?.id;
  const [form, setForm] = useState({
    title: task?.title || "",
    frequency: task?.frequency || "daily",
    time: task?.time || "08:00",
    daysOfWeek: task?.daysOfWeek || [],
    daysOfMonth: task?.daysOfMonth || [],
    active: task?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function toggleDay(d) {
    set(
      "daysOfWeek",
      form.daysOfWeek.includes(d)
        ? form.daysOfWeek.filter((x) => x !== d)
        : [...form.daysOfWeek, d].sort()
    );
  }

  function toggleDate(d) {
    set(
      "daysOfMonth",
      form.daysOfMonth.includes(d)
        ? form.daysOfMonth.filter((x) => x !== d)
        : [...form.daysOfMonth, d].sort((a, b) => a - b)
    );
  }

  async function handleSave() {
    if (!form.title.trim()) return setError("Title is required.");
    if (form.frequency === "weekly" && form.daysOfWeek.length === 0)
      return setError("Select at least one weekday.");
    if (form.frequency === "monthly" && form.daysOfMonth.length === 0)
      return setError("Select at least one date.");

    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, title: form.title.trim() });
      onClose();
    } catch (e) {
      setError(e.message || "Save failed.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="modal-content w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Task" : "New Task"}
          </h2>
          <button onClick={onClose} className="text-ios-gray hover:text-gray-700 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Morning Walk"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue"
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">
              Time
            </label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">
              Frequency
            </label>
            <div className="flex gap-2">
              {["daily", "weekly", "monthly"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set("frequency", f)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-colors
                              ${form.frequency === f
                                ? "bg-ios-blue text-white"
                                : "bg-ios-lightgray text-gray-600 hover:bg-gray-200"
                              }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly: day selector */}
          {form.frequency === "weekly" && (
            <div>
              <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-2">
                Days of Week
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors
                                ${form.daysOfWeek.includes(i)
                                  ? "bg-ios-blue text-white"
                                  : "bg-ios-lightgray text-gray-600 hover:bg-gray-200"
                                }`}
                  >
                    {name[0]}
                  </button>
                ))}
              </div>
              {form.daysOfWeek.length > 0 && (
                <p className="text-xs text-ios-gray mt-1.5">
                  {form.daysOfWeek.map((d) => DAY_FULL[d]).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Monthly: date selector */}
          {form.frequency === "monthly" && (
            <div>
              <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-2">
                Days of Month
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDate(d)}
                    className={`h-9 rounded-lg text-sm font-semibold transition-colors
                                ${form.daysOfMonth.includes(d)
                                  ? "bg-ios-blue text-white"
                                  : "bg-ios-lightgray text-gray-600 hover:bg-gray-200"
                                }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-semibold text-gray-900">Active</p>
              <p className="text-xs text-ios-gray">Inactive tasks won't be scheduled</p>
            </div>
            <button
              type="button"
              onClick={() => set("active", !form.active)}
              className={`w-12 h-6 rounded-full transition-colors relative
                          ${form.active ? "bg-ios-green" : "bg-gray-300"}`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                            ${form.active ? "translate-x-6" : "translate-x-0.5"}`}
              />
            </button>
          </div>

          {error && (
            <p className="text-sm text-ios-red font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-ios-blue text-white font-semibold py-3.5 rounded-xl
                       disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Master Task Card ─────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setDeleting(true);
    await deleteDoc(doc(db, "masterTasks", task.id));
  }

  function describeSchedule(t) {
    if (t.frequency === "daily") return "Every day";
    if (t.frequency === "weekly") {
      return t.daysOfWeek?.map((d) => DAY_NAMES[d]).join(", ") || "Weekly";
    }
    if (t.frequency === "monthly") {
      const dates = t.daysOfMonth?.length ? t.daysOfMonth : [t.dateOfMonth];
      return `Monthly on the ${dates.map((d) => ordinal(d)).join(", ")}`;
    }
    return "";
  }

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm transition-opacity ${deleting ? "opacity-40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-base">{task.title}</p>
            {!task.active && (
              <span className="text-xs text-ios-gray bg-ios-lightgray px-2 py-0.5 rounded-full">
                Inactive
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <FreqBadge freq={task.frequency} />
            <span className="text-xs text-ios-gray">{formatTime(task.time)}</span>
            <span className="text-xs text-ios-gray">·</span>
            <span className="text-xs text-ios-gray">{describeSchedule(task)}</span>
          </div>
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="p-2 text-ios-blue hover:bg-ios-lightgray rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-ios-red hover:bg-red-50 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────
function TasksTab() {
  const [masterTasks, setMasterTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [modalTask, setModalTask] = useState(null); // null=closed, {}=new, task=edit
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "masterTasks"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setMasterTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  async function handleSave(formData) {
    if (modalTask?.id) {
      // Edit
      await updateDoc(doc(db, "masterTasks", modalTask.id), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create
      await addDoc(collection(db, "masterTasks"), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  const filtered =
    filter === "all"
      ? masterTasks
      : masterTasks.filter((t) => t.frequency === filter);

  return (
    <div>
      {/* Filter + Add */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {["all", "daily", "weekly", "monthly"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors
                          ${filter === f
                            ? "bg-ios-blue text-white"
                            : "bg-white text-gray-600 border border-gray-200 hover:bg-ios-lightgray"
                          }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setModalTask({})}
          className="flex items-center gap-1.5 bg-ios-blue text-white px-4 py-2 rounded-xl
                     text-sm font-semibold active:scale-[0.97] transition-transform"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-ios-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 font-medium">No tasks yet</p>
          <p className="text-sm text-ios-gray mt-1">Add your first task above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onEdit={setModalTask}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}

      {modalTask !== null && (
        <TaskModal
          task={modalTask?.id ? modalTask : null}
          onClose={() => setModalTask(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ─── Adhoc Task Modal ─────────────────────────────────────────────────────────
function AdhocTaskModal({ onClose }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const todayStr = getTodayString();

  async function handleSave() {
    if (!title.trim()) return setError("Title is required.");
    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, "taskInstances"), {
        title: title.trim(),
        time,
        date: todayStr,
        status: "pending",
        adhoc: true,
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      setError(e.message || "Failed to create task.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="modal-content w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Adhoc Task</h2>
          <button onClick={onClose} className="text-ios-gray hover:text-gray-700 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">
              Task
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="e.g. Fix broken shelf"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue"
            />
          </div>
          {error && <p className="text-sm text-ios-red font-medium">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-ios-blue text-white font-semibold py-3.5 rounded-xl
                       disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {saving ? "Creating…" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Today Tab ────────────────────────────────────────────────────────────────
function TodayTab() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showAdhocModal, setShowAdhocModal] = useState(false);
  const [isAbsent, setIsAbsent] = useState(false);
  const [absenceWorking, setAbsenceWorking] = useState(false);
  const [completionInfo, setCompletionInfo] = useState(null); // { allCompletedAt, intendedEndTime }
  const todayStr = getTodayString();

  // Real-time listener for today's task instances
  useEffect(() => {
    const q = query(
      collection(db, "taskInstances"),
      where("date", "==", todayStr)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => compareTime(a.time || "00:00", b.time || "00:00"));
      setInstances(data);
      setLoading(false);
    });
    return unsub;
  }, [todayStr]);

  // Real-time listener for absence status + completion info
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "dayStatus", todayStr), (snap) => {
      const data = snap.data() || {};
      setIsAbsent(snap.exists() && data.absent === true);
      if (data.allCompletedAt) {
        setCompletionInfo({
          allCompletedAt: data.allCompletedAt,
          intendedEndTime: data.intendedEndTime || null,
        });
      } else {
        setCompletionInfo(null);
      }
    });
    return unsub;
  }, [todayStr]);

  async function handleMarkAbsent() {
    if (!confirm("Mark Gopal as absent today? All today's tasks will be cleared from his app.")) return;
    setAbsenceWorking(true);
    try {
      // Write absence flag
      await setDoc(doc(db, "dayStatus", todayStr), {
        absent: true,
        markedAt: serverTimestamp(),
        date: todayStr,
      });
      // Delete all today's task instances
      const snap = await getDocs(
        query(collection(db, "taskInstances"), where("date", "==", todayStr))
      );
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } finally {
      setAbsenceWorking(false);
    }
  }

  async function handleMarkPresent() {
    setAbsenceWorking(true);
    try {
      // Clear absence flag
      await setDoc(doc(db, "dayStatus", todayStr), {
        absent: false,
        date: todayStr,
      });
      // Regenerate today's instances
      await generateDayInstances();
    } finally {
      setAbsenceWorking(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm("Delete today's instances and regenerate from master tasks?")) return;
    setRegenerating(true);

    // Delete existing (keep adhoc tasks)
    const snap = await getDocs(
      query(collection(db, "taskInstances"), where("date", "==", todayStr))
    );
    for (const d of snap.docs) {
      if (!d.data().adhoc) await deleteDoc(d.ref);
    }

    // Regenerate
    await generateDayInstances();
    setRegenerating(false);
  }

  const active = instances.filter((t) => t.status !== "postponed");
  const postponed = instances.filter((t) => t.status === "postponed");
  const done = instances.filter((t) => t.status === "done").length;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {formatDisplayDate(todayStr)}
          </p>
          <p className="text-xs text-ios-gray mt-0.5">
            {done}/{instances.length} tasks completed
            {postponed.length > 0 && (
              <span className="ml-1.5 text-amber-500 font-semibold">
                · {postponed.length} postponed
              </span>
            )}
          </p>
          {completionInfo && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                ✓ Done at {formatTime(toHHMM(completionInfo.allCompletedAt))}
              </span>
              {completionInfo.intendedEndTime && (
                <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full">
                  Intended {formatTime(completionInfo.intendedEndTime)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAbsent ? (
            <button
              onClick={handleMarkPresent}
              disabled={absenceWorking}
              className="text-xs font-semibold text-white bg-ios-red px-3 py-1.5 rounded-xl
                         hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {absenceWorking ? "…" : "🔴 Mark Present"}
            </button>
          ) : (
            <button
              onClick={handleMarkAbsent}
              disabled={absenceWorking}
              className="text-xs font-semibold text-ios-red border border-red-200 px-3 py-1.5 rounded-xl
                         hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {absenceWorking ? "…" : "Mark Absent"}
            </button>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating || isAbsent}
            className="text-xs text-ios-blue font-semibold px-3 py-1.5 rounded-xl
                       border border-ios-blue/30 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {regenerating ? "Regenerating…" : "↻ Regenerate"}
          </button>
          <button
            onClick={() => setShowAdhocModal(true)}
            disabled={isAbsent}
            className="flex items-center gap-1.5 bg-ios-blue text-white px-4 py-2 rounded-xl
                       text-sm font-semibold active:scale-[0.97] transition-transform shadow-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Adhoc Task
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-ios-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active tasks */}
          {active.length === 0 && postponed.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 font-medium">No instances today</p>
              <p className="text-sm text-ios-gray mt-1">{isAbsent ? "Gopal is marked absent" : "Regenerate to create today's tasks"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((t) => (
                <div
                  key={t.id}
                  className={`bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3
                              ${t.status === "done" ? "opacity-60" : ""}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2
                                 ${t.status === "done" ? "bg-ios-green border-ios-green" : "border-gray-300"}`}
                  >
                    {t.status === "done" && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-semibold text-gray-900 ${t.status === "done" ? "line-through" : ""}`}>
                        {t.title}
                      </p>
                      {t.adhoc && (
                        <span className="text-xs bg-violet-100 text-violet-600 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          adhoc
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ios-gray">
                      {formatTime(t.time)}
                      {t.status === "done" && t.completedAt && (
                        <span className="ml-1.5 text-ios-green font-semibold">
                          · done {formatTime(toHHMM(t.completedAt))}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0
                                 ${t.status === "done"
                                   ? "bg-green-100 text-green-700"
                                   : "bg-gray-100 text-gray-500"
                                 }`}
                  >
                    {t.status === "done" ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Postponed section */}
          {postponed.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-amber-600">⏸ Postponed</span>
                <div className="flex-1 h-px bg-amber-200" />
                <span className="text-xs text-amber-500 font-semibold">{postponed.length}</span>
              </div>
              <div className="space-y-3">
                {postponed.map((t) => (
                  <div
                    key={t.id}
                    className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
                                     bg-amber-200 border-2 border-amber-300 mt-0.5"
                      >
                        <svg className="w-3 h-3 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                        <p className="text-xs text-ios-gray">{formatTime(t.time)}</p>
                        {t.postponeAudioBase64 && (
                          <div className="mt-2">
                            <p className="text-xs text-amber-600 font-semibold mb-1">🎤 Gopal&apos;s voice note:</p>
                            <audio
                              controls
                              src={t.postponeAudioBase64}
                              className="w-full"
                              style={{ height: "36px" }}
                            />
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                        Postponed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showAdhocModal && (
        <AdhocTaskModal onClose={() => setShowAdhocModal(false)} />
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(7);

  useEffect(() => {
    setLoading(true);
    getAnalytics(range).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [range]);

  const totalDone = data.reduce((s, d) => s + d.done, 0);
  const totalTasks = data.reduce((s, d) => s + d.total, 0);
  const avgRate = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const maxDone = Math.max(...data.map((d) => d.total), 1);

  return (
    <div>
      {/* Range selector */}
      <div className="flex gap-2 mb-5">
        {[7, 14, 30].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors
                        ${range === r
                          ? "bg-ios-blue text-white"
                          : "bg-white text-gray-600 border border-gray-200"
                        }`}
          >
            {r}d
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Completion" value={`${avgRate}%`} color="text-ios-green" />
        <StatCard label="Total Done" value={totalDone} color="text-ios-blue" />
        <StatCard label="Scheduled" value={totalTasks} color="text-gray-600" />
      </div>

      {/* Bar chart */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-ios-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-ios-gray uppercase tracking-wider mb-4">
            Daily completion ({range} days)
          </p>
          <div className="flex items-end gap-1.5 h-28">
            {data.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: "80px" }}>
                  {/* Done bar */}
                  <div
                    className="w-full bg-ios-green rounded-sm transition-all duration-500"
                    style={{ height: `${(d.done / maxDone) * 80}px` }}
                    title={`${d.done} done`}
                  />
                  {/* Pending bar */}
                  {d.total > d.done && (
                    <div
                      className="w-full bg-gray-200 rounded-sm"
                      style={{ height: `${((d.total - d.done) / maxDone) * 80}px` }}
                      title={`${d.total - d.done} pending`}
                    />
                  )}
                </div>
                <span className="text-[9px] text-ios-gray">
                  {d.label.split(",")[0].split(" ").pop()}
                </span>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-ios-green" />
              <span className="text-xs text-ios-gray">Done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-200" />
              <span className="text-xs text-ios-gray">Pending</span>
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      {!loading && data.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-ios-gray uppercase tracking-wider">History</p>
          </div>
          {[...data].reverse().map((d) => (
            <div key={d.date} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{d.label}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ios-gray">{d.done}/{d.total}</span>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ios-green rounded-full"
                    style={{ width: `${d.rate}%` }}
                  />
                </div>
                <span className={`text-xs font-semibold w-8 text-right
                                  ${d.rate >= 80 ? "text-ios-green" : d.rate >= 50 ? "text-yellow-500" : "text-ios-red"}`}>
                  {d.rate}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-ios-gray mt-0.5">{label}</p>
    </div>
  );
}

// ─── Staff Tab Helpers ────────────────────────────────────────────────────────
const WORKERS = [
  { id: "gopal",    name: "Gopal",    role: "Maid",          initials: "G" },
  { id: "draupadi", name: "Draupadi", role: "Cook",          initials: "D" },
  { id: "savitri",  name: "Savitri",  role: "Sweeper",       initials: "S" },
  { id: "milkman",  name: "Milkman",  role: "Milk delivery", initials: "M" },
];
const AVATAR_STYLE = [
  { bg: "bg-blue-100",   text: "text-blue-700"   },
  { bg: "bg-teal-100",   text: "text-teal-700"   },
  { bg: "bg-amber-100",  text: "text-amber-700"  },
  { bg: "bg-purple-100", text: "text-purple-700" },
];
const CAL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DAY_LABELS  = ["M","T","W","T","F","S","S"];

function calDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function calFirstWeekday(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0…Sun=6
}
function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function currentMonthStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
function labelMonthStr(ms) {
  const [y, m] = ms.split("-");
  return `${CAL_MONTH_NAMES[+m - 1]} ${y}`;
}

// ─── Add Payment Modal ────────────────────────────────────────────────────────
function AddPaymentModal({ workerId, workerName, defaultMonth, onClose }) {
  const [amount, setAmount] = useState("");
  const [pDate, setPDate]   = useState(getTodayString());
  const [note, setNote]     = useState("");
  const [month, setMonth]   = useState(defaultMonth || currentMonthStr());
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const monthOptions = Array.from({ length: 4 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value: ms, label: labelMonthStr(ms) };
  });

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) return setError("Enter a valid amount.");
    setSaving(true); setError("");
    try {
      await addDoc(collection(db, "payments"), {
        workerId, amount: amt, date: pDate,
        note: note.trim(), month, createdAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      setError(e.message || "Failed to save."); setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="modal-content w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add payment — {workerName}</h2>
          <button onClick={onClose} className="text-ios-gray hover:text-gray-700 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">Amount (₹)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 2000" autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">Date</label>
            <input type="date" value={pDate} onChange={e => setPDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">Applies to month</label>
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue">
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-1.5">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. advance, bonus…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue" />
          </div>
          {error && <p className="text-sm text-ios-red font-medium">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-ios-blue text-white font-semibold py-3.5 rounded-xl
                       disabled:opacity-50 active:scale-[0.98] transition-transform">
            {saving ? "Saving…" : "Save Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Payments Segment ─────────────────────────────────────────────────────────
function PaymentsSegment() {
  const [selectedWorker, setSelectedWorker] = useState("gopal");
  const [allPayments, setAllPayments]       = useState([]);
  const [monthlySalary, setMonthlySalary]   = useState(0);
  const [editingSalary, setEditingSalary]   = useState(false);
  const [salaryInput, setSalaryInput]       = useState("");
  const [showAdd, setShowAdd]               = useState(false);
  const [viewMonth, setViewMonth]           = useState(currentMonthStr());

  const monthOptions = Array.from({ length: 4 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value: ms, label: labelMonthStr(ms) };
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "workerConfig", selectedWorker), snap => {
      setMonthlySalary(snap.data()?.monthlySalary || 0);
    });
    return unsub;
  }, [selectedWorker]);

  useEffect(() => {
    const q = query(
      collection(db, "payments"),
      where("workerId", "==", selectedWorker),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setAllPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [selectedWorker]);

  const payments  = allPayments.filter(p => p.month === viewMonth);
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const balance   = monthlySalary > 0 ? monthlySalary - totalPaid : null;
  const paidPct   = monthlySalary > 0 ? Math.min(100, Math.round((totalPaid / monthlySalary) * 100)) : 0;

  async function saveSalary() {
    const val = parseFloat(salaryInput);
    if (isNaN(val) || val < 0) return;
    await setDoc(doc(db, "workerConfig", selectedWorker), { monthlySalary: val }, { merge: true });
    setEditingSalary(false);
  }

  async function handleDeletePayment(id) {
    if (!confirm("Delete this payment?")) return;
    await deleteDoc(doc(db, "payments", id));
  }

  const worker = WORKERS.find(w => w.id === selectedWorker);

  return (
    <div>
      {/* Worker tabs */}
      <div className="flex border-b border-gray-200 mb-4 -mx-4 px-4">
        {WORKERS.map(w => (
          <button key={w.id} onClick={() => setSelectedWorker(w.id)}
            className={`px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors
                        ${selectedWorker === w.id
                          ? "border-ios-blue text-ios-blue"
                          : "border-transparent text-ios-gray hover:text-gray-600"}`}>
            {w.name}
          </button>
        ))}
      </div>

      {/* Month filter */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {monthOptions.map(o => (
          <button key={o.value} onClick={() => setViewMonth(o.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors
                        ${viewMonth === o.value
                          ? "bg-ios-blue text-white"
                          : "bg-white text-gray-600 border border-gray-200"}`}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Salary card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-gray-900">{labelMonthStr(viewMonth)} salary</p>
          {balance !== null && (
            <span className={`text-sm font-semibold ${balance > 0 ? "text-ios-blue" : "text-ios-green"}`}>
              {balance > 0 ? `₹${balance.toLocaleString()} balance` : "Fully paid ✓"}
            </span>
          )}
        </div>
        {monthlySalary > 0 && !editingSalary && (
          <>
            <div className="h-2 bg-ios-lightgray rounded-full overflow-hidden my-2">
              <div className="h-full bg-ios-green rounded-full transition-all duration-500"
                   style={{ width: `${paidPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-ios-gray">
              <span>₹{totalPaid.toLocaleString()} paid</span>
              <button onClick={() => { setEditingSalary(true); setSalaryInput(String(monthlySalary)); }}
                className="text-ios-blue font-medium">
                ₹{monthlySalary.toLocaleString()} total · edit
              </button>
            </div>
          </>
        )}
        {monthlySalary === 0 && !editingSalary && (
          <p className="text-xs text-ios-gray mt-1">
            ₹{totalPaid.toLocaleString()} paid ·{" "}
            <button onClick={() => { setEditingSalary(true); setSalaryInput(""); }}
              className="text-ios-blue font-semibold">Set monthly salary →</button>
          </p>
        )}
        {editingSalary && (
          <div className="flex gap-2 mt-2">
            <input type="number" value={salaryInput} onChange={e => setSalaryInput(e.target.value)}
              placeholder="Monthly ₹" autoFocus
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-ios-blue/30" />
            <button onClick={saveSalary}
              className="bg-ios-blue text-white px-4 py-2 rounded-xl text-sm font-semibold">Save</button>
            <button onClick={() => setEditingSalary(false)}
              className="text-ios-gray px-3 py-2 text-sm">✕</button>
          </div>
        )}
      </div>

      {/* Payment list */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-ios-gray uppercase tracking-wider">Payments</p>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-ios-blue text-white px-3 py-1.5 rounded-xl
                     text-sm font-semibold active:scale-[0.97] transition-transform shadow-sm">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-2xl shadow-sm">
          <p className="text-gray-400 text-sm">No payments for {labelMonthStr(viewMonth)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-ios-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">₹{(p.amount || 0).toLocaleString()}</p>
                <p className="text-xs text-ios-gray">
                  {p.date}{p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <button onClick={() => handleDeletePayment(p.id)}
                className="p-1.5 text-ios-gray hover:text-ios-red transition-colors rounded-lg hover:bg-red-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddPaymentModal workerId={selectedWorker} workerName={worker?.name}
          defaultMonth={viewMonth} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}

// ─── Attendance Segment ───────────────────────────────────────────────────────
function AttendanceSegment() {
  const todayStr = getTodayString();
  const nowDate  = new Date();

  const [todayAbsences, setTodayAbsences] = useState({});
  const [selectedWorker, setSelectedWorker] = useState("gopal");
  const [calYear,  setCalYear]  = useState(nowDate.getFullYear());
  const [calMonth, setCalMonth] = useState(nowDate.getMonth()); // 0-based
  const [absentSet, setAbsentSet] = useState(new Set());
  const [working, setWorking] = useState({});

  // Real-time listeners for today's absences (all workers)
  useEffect(() => {
    const unsubs = [];
    // Gopal: driven by dayStatus (same doc Today tab uses)
    unsubs.push(onSnapshot(doc(db, "dayStatus", todayStr), snap => {
      setTodayAbsences(prev => ({ ...prev, gopal: snap.exists() && snap.data()?.absent === true }));
    }));
    // Others: attendance collection
    ["draupadi", "savitri", "milkman"].forEach(id => {
      unsubs.push(onSnapshot(doc(db, "attendance", `${id}_${todayStr}`), snap => {
        setTodayAbsences(prev => ({ ...prev, [id]: snap.exists() && snap.data()?.absent === true }));
      }));
    });
    return () => unsubs.forEach(u => u());
  }, [todayStr]);

  // Fetch calendar absences for selected worker + displayed month
  useEffect(() => {
    async function fetchAbsences() {
      const first = toDateStr(calYear, calMonth, 1);
      const last  = toDateStr(calYear, calMonth, calDaysInMonth(calYear, calMonth));
      const absent = new Set();

      if (selectedWorker === "gopal") {
        const snap = await getDocs(
          query(collection(db, "dayStatus"), where("date", ">=", first), where("date", "<=", last))
        );
        snap.forEach(d => { if (d.data().absent === true) absent.add(d.data().date); });
      } else {
        // Query by date range only to avoid needing a composite index
        const snap = await getDocs(
          query(collection(db, "attendance"), where("date", ">=", first), where("date", "<=", last))
        );
        snap.forEach(d => {
          const dat = d.data();
          if (dat.workerId === selectedWorker && dat.absent === true) absent.add(dat.date);
        });
      }
      setAbsentSet(absent);
    }
    fetchAbsences();
  }, [selectedWorker, calYear, calMonth]);

  function isAbsentOnDate(ds) {
    if (ds === todayStr) return todayAbsences[selectedWorker] || false;
    return absentSet.has(ds);
  }

  async function toggleTodayAbsent(workerId) {
    const isAbsent = todayAbsences[workerId] || false;
    const key = `${workerId}_today`;
    setWorking(prev => ({ ...prev, [key]: true }));
    try {
      if (workerId === "gopal") {
        if (!isAbsent) {
          if (!confirm("Mark Gopal as absent today? All today's tasks will be cleared from his app.")) return;
          await setDoc(doc(db, "dayStatus", todayStr), { absent: true, markedAt: serverTimestamp(), date: todayStr });
          const snap = await getDocs(query(collection(db, "taskInstances"), where("date", "==", todayStr)));
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        } else {
          await setDoc(doc(db, "dayStatus", todayStr), { absent: false, date: todayStr });
          await generateDayInstances();
        }
      } else {
        if (!isAbsent) {
          await setDoc(doc(db, "attendance", `${workerId}_${todayStr}`), {
            workerId, date: todayStr, absent: true, markedAt: serverTimestamp(),
          });
        } else {
          await deleteDoc(doc(db, "attendance", `${workerId}_${todayStr}`));
        }
      }
      // Sync calendar set if showing current month
      if (workerId === selectedWorker && calYear === nowDate.getFullYear() && calMonth === nowDate.getMonth()) {
        setAbsentSet(prev => {
          const next = new Set(prev);
          !isAbsent ? next.add(todayStr) : next.delete(todayStr);
          return next;
        });
      }
    } finally {
      setWorking(prev => ({ ...prev, [key]: false }));
    }
  }

  async function toggleCalendarDay(ds) {
    if (ds > todayStr) return;
    if (ds === todayStr) { toggleTodayAbsent(selectedWorker); return; }

    const isAbsent = absentSet.has(ds);
    // Optimistic update
    setAbsentSet(prev => {
      const next = new Set(prev);
      isAbsent ? next.delete(ds) : next.add(ds);
      return next;
    });
    try {
      if (selectedWorker === "gopal") {
        await setDoc(doc(db, "dayStatus", ds), { absent: !isAbsent, date: ds }, { merge: true });
      } else {
        if (!isAbsent) {
          await setDoc(doc(db, "attendance", `${selectedWorker}_${ds}`), {
            workerId: selectedWorker, date: ds, absent: true, markedAt: serverTimestamp(),
          });
        } else {
          await deleteDoc(doc(db, "attendance", `${selectedWorker}_${ds}`));
        }
      }
    } catch {
      // Revert on error
      setAbsentSet(prev => {
        const next = new Set(prev);
        isAbsent ? next.add(ds) : next.delete(ds);
        return next;
      });
    }
  }

  const daysCount      = calDaysInMonth(calYear, calMonth);
  const startOffset    = calFirstWeekday(calYear, calMonth);
  const isCurrentMonth = calYear === nowDate.getFullYear() && calMonth === nowDate.getMonth();
  const daysElapsed    = isCurrentMonth ? nowDate.getDate() : daysCount;
  const daysLeft       = daysCount - daysElapsed;

  let presentCount = 0, absentCount = 0;
  for (let d = 1; d <= daysElapsed; d++) {
    if (isAbsentOnDate(toDateStr(calYear, calMonth, d))) absentCount++;
    else presentCount++;
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  return (
    <div>
      {/* Today quick-mark row */}
      <p className="text-xs font-semibold text-ios-gray uppercase tracking-wider mb-2">
        Today — {formatDisplayDate(todayStr)}
      </p>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5">
        {WORKERS.map((w, i) => {
          const isAbsent  = todayAbsences[w.id] || false;
          const av        = AVATAR_STYLE[i];
          const isWorking = working[`${w.id}_today`];
          return (
            <div key={w.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-3">
              <div className={`w-9 h-9 rounded-full ${av.bg} ${av.text} flex items-center justify-center text-sm font-semibold flex-shrink-0`}>
                {w.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                <p className="text-xs text-ios-gray">{w.role}</p>
              </div>
              {isAbsent ? (
                <button onClick={() => toggleTodayAbsent(w.id)} disabled={isWorking}
                  className="text-xs font-semibold text-white bg-ios-red px-3 py-1.5 rounded-xl
                             hover:opacity-90 transition-opacity disabled:opacity-50">
                  {isWorking ? "…" : "Absent · Undo"}
                </button>
              ) : (
                <button onClick={() => toggleTodayAbsent(w.id)} disabled={isWorking}
                  className="text-xs font-semibold text-ios-red border border-red-200 px-3 py-1.5 rounded-xl
                             hover:bg-red-50 transition-colors disabled:opacity-50">
                  {isWorking ? "…" : "Mark absent"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Calendar + worker selector */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs font-semibold text-ios-gray uppercase tracking-wider">Calendar</p>
        <div className="flex gap-1 flex-wrap">
          {WORKERS.map((w, i) => {
            const av = AVATAR_STYLE[i];
            return (
              <button key={w.id} onClick={() => setSelectedWorker(w.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors
                            ${selectedWorker === w.id ? `${av.bg} ${av.text}` : "bg-gray-100 text-ios-gray"}`}>
                {w.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">{CAL_MONTH_NAMES[calMonth]} {calYear}</p>
          <div className="flex gap-1">
            <button onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-ios-lightgray text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={nextMonth} disabled={isCurrentMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-ios-lightgray text-gray-600 transition-colors disabled:opacity-30">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-1">
          {CAL_DAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold text-ios-gray py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: startOffset }).map((_, i) => <div key={`gap-${i}`} />)}
          {Array.from({ length: daysCount }, (_, i) => {
            const day      = i + 1;
            const ds       = toDateStr(calYear, calMonth, day);
            const absent   = isAbsentOnDate(ds);
            const isToday  = ds === todayStr;
            const isFuture = ds > todayStr;
            return (
              <button key={day} onClick={() => !isFuture && toggleCalendarDay(ds)} disabled={isFuture}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors
                            ${isFuture
                              ? "text-gray-300 cursor-default"
                              : isToday
                                ? absent ? "bg-ios-red text-white" : "bg-ios-blue text-white"
                                : absent
                                  ? "bg-red-100 text-ios-red font-semibold"
                                  : "text-gray-700 hover:bg-ios-lightgray cursor-pointer"
                            }`}>
                {day}
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="flex mt-4 pt-3 border-t border-gray-100">
          <div className="flex-1 text-center">
            <p className="text-xl font-bold text-ios-green">{presentCount}</p>
            <p className="text-xs text-ios-gray mt-0.5">Present</p>
          </div>
          <div className="w-px bg-gray-100" />
          <div className="flex-1 text-center">
            <p className="text-xl font-bold text-ios-red">{absentCount}</p>
            <p className="text-xs text-ios-gray mt-0.5">Absent</p>
          </div>
          <div className="w-px bg-gray-100" />
          <div className="flex-1 text-center">
            <p className="text-xl font-bold text-gray-400">{daysLeft}</p>
            <p className="text-xs text-ios-gray mt-0.5">Remaining</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Staff Tab ────────────────────────────────────────────────────────────────
function StaffTab() {
  const [segment, setSegment] = useState("attendance");
  return (
    <div>
      <div className="flex bg-ios-lightgray rounded-xl p-1 mb-5 gap-1">
        {["attendance", "payments"].map(s => (
          <button key={s} onClick={() => setSegment(s)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-colors
                        ${segment === s ? "bg-white text-gray-900 shadow-sm" : "text-ios-gray"}`}>
            {s}
          </button>
        ))}
      </div>
      {segment === "attendance" ? <AttendanceSegment /> : <PaymentsSegment />}
    </div>
  );
}

// ─── Main Admin View ──────────────────────────────────────────────────────────
export default function AdminView() {
  const [tab, setTab] = useState("today");
  const { logout } = useAuth();
  const router = useRouter();

  const tabs = [
    { id: "today",     label: "Today",     icon: "📅" },
    { id: "tasks",     label: "Tasks",     icon: "☑"  },
    { id: "staff",     label: "Staff",     icon: "👥" },
    { id: "analytics", label: "Analytics", icon: "📊" },
  ];

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-ios-lightgray flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 safe-top">
        <div className="px-5 pb-3 pt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-xs text-ios-gray">{formatDisplayDate(getTodayString())}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-ios-gray font-medium px-2 py-1 rounded-lg
                       active:bg-ios-lightgray transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-1 pb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold
                          border-b-2 transition-colors
                          ${tab === t.id
                            ? "border-ios-blue text-ios-blue"
                            : "border-transparent text-ios-gray hover:text-gray-600"
                          }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 safe-bottom max-w-2xl mx-auto w-full">
        {tab === "today"     && <TodayTab />}
        {tab === "tasks"     && <TasksTab />}
        {tab === "staff"     && <StaffTab />}
        {tab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}

// Converts a Firestore Timestamp (or Date) to "HH:MM" for formatTime
function toHHMM(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Ordinal helper (1 → "1st", 2 → "2nd", etc.)
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
