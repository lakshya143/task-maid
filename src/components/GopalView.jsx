"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getTodayString,
  formatDisplayDate,
  formatTime,
  compareTime,
  generateDayInstances,
} from "@/lib/scheduler";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

// ─── Task Item ────────────────────────────────────────────────────────────────
function TaskItem({ task }) {
  const [animating, setAnimating] = useState(false);
  const isDone = task.status === "done";

  async function handleTap() {
    if (animating) return;
    setAnimating(true);

    const ref = doc(db, "taskInstances", task.id);
    await updateDoc(ref, {
      status: isDone ? "pending" : "done",
      completedAt: isDone ? null : serverTimestamp(),
    });

    setTimeout(() => setAnimating(false), 300);
  }

  return (
    <button
      onClick={handleTap}
      className={`task-item tap-scale w-full flex items-center gap-4 px-4 py-4
                  bg-white rounded-2xl shadow-sm active:scale-[0.97]
                  ${isDone ? "completed" : ""}`}
    >
      {/* Circle checkbox */}
      <div
        className={`task-circle w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center border-2
                    ${isDone
                      ? "bg-ios-green border-ios-green"
                      : "border-gray-300"
                    }`}
      >
        {isDone && (
          <svg
            className="check-pop w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Task info */}
      <div className="flex-1 text-left">
        <p className={`task-title text-base font-medium text-gray-900 leading-snug
                       ${isDone ? "line-through opacity-40" : ""}`}>
          {task.title}
        </p>
      </div>

      {/* Chevron hint (only on pending) */}
      {!isDone && (
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

// ─── Time Group ───────────────────────────────────────────────────────────────
function TimeGroup({ time, tasks }) {
  return (
    <div className="mb-6">
      {/* Time label */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-sm font-semibold text-ios-blue tracking-wide">
          {formatTime(time)}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Tasks at this time */}
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Gopal View ──────────────────────────────────────────────────────────
export default function GopalView() {
  const { logout } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const todayStr = getTodayString();

  // Generate today's instances (idempotent)
  useEffect(() => {
    async function init() {
      setGenerating(true);
      try {
        await generateDayInstances();
      } catch (err) {
        console.error("Schedule generation error:", err);
      }
      setGenerating(false);
    }
    init();
  }, []);

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
      setTasks(data);
      setLoading(false);
    });

    return unsub;
  }, [todayStr]);

  // Group tasks by time
  const grouped = tasks.reduce((acc, task) => {
    const key = task.time || "00:00";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const sortedTimes = Object.keys(grouped).sort(compareTime);
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-ios-lightgray flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-ios-blue border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ios-gray">
          {generating ? "Setting up your day…" : "Loading tasks…"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ios-lightgray flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 safe-top">
        <div className="px-5 pb-4 pt-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-ios-gray font-medium">
                {formatDisplayDate(todayStr)}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
                Good {getGreeting()}, Gopal 👋
              </h1>
            </div>
            <button
              onClick={handleLogout}
              className="mt-1 text-xs text-ios-gray font-medium px-2 py-1 rounded-lg
                         active:bg-ios-lightgray transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-ios-gray mb-1.5">
              <span>{allDone ? "All tasks complete! 🎉" : `${doneCount} of ${totalCount} done`}</span>
              <span className="font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-ios-lightgray rounded-full overflow-hidden">
              <div
                className="h-full bg-ios-green rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Task Timeline */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-5 safe-bottom">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <span className="text-3xl">🌿</span>
            </div>
            <p className="text-gray-500 font-medium">No tasks today</p>
            <p className="text-sm text-ios-gray mt-1">Enjoy your free day!</p>
          </div>
        ) : allDone ? (
          <>
            <div className="flex flex-col items-center justify-center py-8 text-center mb-6">
              <div className="w-16 h-16 bg-ios-green rounded-full flex items-center justify-center shadow-sm mb-3">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900">All done!</p>
              <p className="text-sm text-ios-gray mt-1">Great work today 💪</p>
            </div>
            {sortedTimes.map((time) => (
              <TimeGroup key={time} time={time} tasks={grouped[time]} />
            ))}
          </>
        ) : (
          sortedTimes.map((time) => (
            <TimeGroup key={time} time={time} tasks={grouped[time]} />
          ))
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
