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
  const todayStr = getTodayString();

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
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-xs text-ios-blue font-semibold px-3 py-1.5 rounded-xl
                       border border-ios-blue/30 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {regenerating ? "Regenerating…" : "↻ Regenerate"}
          </button>
          <button
            onClick={() => setShowAdhocModal(true)}
            className="flex items-center gap-1.5 bg-ios-blue text-white px-4 py-2 rounded-xl
                       text-sm font-semibold active:scale-[0.97] transition-transform shadow-sm"
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
              <p className="text-sm text-ios-gray mt-1">Regenerate to create today&apos;s tasks</p>
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
                    <p className="text-xs text-ios-gray">{formatTime(t.time)}</p>
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

// ─── Main Admin View ──────────────────────────────────────────────────────────
export default function AdminView() {
  const [tab, setTab] = useState("today");
  const { logout } = useAuth();
  const router = useRouter();

  const tabs = [
    { id: "today", label: "Today", icon: "📅" },
    { id: "tasks", label: "Tasks", icon: "☑" },
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
        {tab === "tasks" && <TasksTab />}
        {tab === "today" && <TodayTab />}
        {tab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}

// Ordinal helper (1 → "1st", 2 → "2nd", etc.)
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
