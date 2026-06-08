"use client";

import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteField,
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

// ─── Helper ───────────────────────────────────────────────────────────────────
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Postpone Modal ───────────────────────────────────────────────────────────
function PostponeModal({ task, onClose }) {
  const [phase, setPhase] = useState("idle"); // idle | recording | recorded
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setPhase("recorded");
        clearInterval(timerRef.current);
      };

      mr.start(100);
      mediaRecorderRef.current = mr;
      setPhase("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError("Microphone access denied. Please allow mic and try again.");
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  async function handleConfirm() {
    if (!audioBlob) return;
    setSaving(true);
    try {
      const base64 = await blobToBase64(audioBlob);
      await updateDoc(doc(db, "taskInstances", task.id), {
        status: "postponed",
        postponeAudioBase64: base64,
        postponedAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      setError("Save failed. Please try again.");
      setSaving(false);
    }
  }

  function handleReRecord() {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setPhase("idle");
    setSeconds(0);
  }

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="w-full bg-white rounded-t-2xl pt-5 pb-10 px-6">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <h2 className="text-lg font-bold text-gray-900 mb-1">Postpone Task</h2>
        <p className="text-sm text-ios-gray mb-6 leading-snug line-clamp-2">{task.title}</p>

        {/* Idle: prompt to record */}
        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-600 text-center">
              Record a voice note explaining why you&apos;re postponing.
            </p>
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-ios-red flex items-center justify-center shadow-lg
                         active:scale-95 transition-transform"
            >
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
                <path d="M19 11a1 1 0 00-2 0 5 5 0 01-10 0 1 1 0 00-2 0A7 7 0 0011 17.92V20H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.08A7 7 0 0019 11z" />
              </svg>
            </button>
            <p className="text-xs text-ios-gray">Tap to record</p>
          </div>
        )}

        {/* Recording */}
        {phase === "recording" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-ios-red animate-pulse" />
              <span className="text-sm font-semibold text-ios-red">Recording</span>
              <span className="text-sm text-ios-gray font-mono">{fmt(seconds)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center shadow-lg
                         active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-white rounded-md" />
            </button>
            <p className="text-xs text-ios-gray">Tap to stop</p>
          </div>
        )}

        {/* Recorded: preview + confirm */}
        {phase === "recorded" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 font-medium">Preview your note:</p>
            <audio controls src={audioUrl} className="w-full" />
            <div className="flex gap-3 mt-1">
              <button
                onClick={handleReRecord}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700
                           active:scale-[0.97] transition-transform"
              >
                Re-record
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 py-3.5 rounded-xl bg-amber-500 text-white text-sm font-semibold
                           disabled:opacity-50 active:scale-[0.97] transition-transform"
              >
                {saving ? "Saving…" : "Postpone Task"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-ios-red font-medium text-center mt-4">{error}</p>
        )}

        <button
          onClick={onClose}
          className="w-full mt-5 py-3 text-ios-gray text-sm font-medium text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Task Item ────────────────────────────────────────────────────────────────
function TaskItem({ task, onPostpone }) {
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
    <div
      className={`task-item w-full flex items-center gap-3 px-4 py-4
                  bg-white rounded-2xl shadow-sm
                  ${isDone ? "completed" : ""}`}
    >
      {/* Tap area: circle + title */}
      <button
        onClick={handleTap}
        className="flex items-center gap-4 flex-1 text-left tap-scale active:scale-[0.97]"
      >
        <div
          className={`task-circle w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center border-2
                      ${isDone ? "bg-ios-green border-ios-green" : "border-gray-300"}`}
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

        <p
          className={`task-title text-base font-medium text-gray-900 leading-snug
                       ${isDone ? "line-through opacity-40" : ""}`}
        >
          {task.title}
        </p>
      </button>

      {/* Right action */}
      {!isDone ? (
        <button
          onClick={() => onPostpone(task)}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center
                     active:scale-90 transition-transform"
          title="Postpone task"
        >
          <svg
            className="w-4 h-4 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
          </svg>
        </button>
      ) : (
        <svg
          className="w-4 h-4 text-gray-300 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
}

// ─── Postponed Task Item ─────────────────────────────────────────────────────
function PostponedTaskItem({ task }) {
  const [done, setDone] = useState(false);

  async function handleTap() {
    if (done) return;
    setDone(true);
    await updateDoc(doc(db, "taskInstances", task.id), {
      status: "done",
      completedAt: serverTimestamp(),
      postponeAudioBase64: deleteField(),
    });
  }

  return (
    <button
      onClick={handleTap}
      className="task-item tap-scale w-full flex items-center gap-4 px-4 py-4
                 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm active:scale-[0.97]"
    >
      <div
        className={`task-circle w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors
                    ${done ? "bg-ios-green border-ios-green" : "bg-amber-100 border-amber-400"}`}
      >
        {done ? (
          <svg className="check-pop w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
          </svg>
        )}
      </div>
      <p className="task-title text-base font-medium text-gray-600 leading-snug flex-1 text-left">
        {task.title}
      </p>
    </button>
  );
}

// ─── Time Group ───────────────────────────────────────────────────────────────
function TimeGroup({ time, tasks, onPostpone }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-sm font-semibold text-ios-blue tracking-wide">
          {formatTime(time)}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} onPostpone={onPostpone} />
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
  const [postponeTask, setPostponeTask] = useState(null);
  const [isAbsent, setIsAbsent] = useState(false);
  const todayStr = getTodayString();

  // Generate today's instances (skip if absent)
  useEffect(() => {
    async function init() {
      setGenerating(true);
      try {
        const statusSnap = await getDoc(doc(db, "dayStatus", todayStr));
        if (statusSnap.exists() && statusSnap.data()?.absent === true) {
          setIsAbsent(true);
          setGenerating(false);
          return;
        }
        await generateDayInstances();
      } catch (err) {
        console.error("Schedule generation error:", err);
      }
      setGenerating(false);
    }
    init();
  }, [todayStr]);

  // Real-time listener for absence status (admin can mark absent while app is open)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "dayStatus", todayStr), (snap) => {
      setIsAbsent(snap.exists() && snap.data()?.absent === true);
    });
    return unsub;
  }, [todayStr]);

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

  // Separate active from postponed
  const activeTasks = tasks.filter((t) => t.status !== "postponed");
  const postponedTasks = tasks.filter((t) => t.status === "postponed");

  // Group active tasks by time
  const grouped = activeTasks.reduce((acc, task) => {
    const key = task.time || "00:00";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const sortedTimes = Object.keys(grouped).sort(compareTime);
  const doneCount = activeTasks.filter((t) => t.status === "done").length;
  const totalCount = activeTasks.length;
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

  const taskTimeline = sortedTimes.map((time) => (
    <TimeGroup key={time} time={time} tasks={grouped[time]} onPostpone={setPostponeTask} />
  ));

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
              <span>
                {allDone ? "All tasks complete! 🎉" : `${doneCount} of ${totalCount} done`}
                {postponedTasks.length > 0 && (
                  <span className="ml-2 text-amber-500 font-semibold">
                    · {postponedTasks.length} postponed
                  </span>
                )}
              </span>
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
        {isAbsent ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <span className="text-4xl">🏖️</span>
            </div>
            <p className="text-gray-700 font-bold text-lg">Day Off</p>
            <p className="text-sm text-ios-gray mt-1">No tasks today. Rest well!</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <span className="text-3xl">🌿</span>
            </div>
            <p className="text-gray-500 font-medium">No tasks today</p>
            <p className="text-sm text-ios-gray mt-1">Enjoy your free day!</p>
          </div>
        ) : (
          <>
            {/* Active tasks */}
            {allDone && activeTasks.length > 0 ? (
              <>
                <div className="flex flex-col items-center justify-center py-8 text-center mb-6">
                  <div className="w-16 h-16 bg-ios-green rounded-full flex items-center justify-center shadow-sm mb-3">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-gray-900">All done!</p>
                  <p className="text-sm text-ios-gray mt-1">Great work today 💪</p>
                </div>
                {taskTimeline}
              </>
            ) : (
              taskTimeline
            )}

            {/* Postponed section */}
            {postponedTasks.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-sm font-semibold text-amber-600">⏸ Postponed</span>
                  <div className="flex-1 h-px bg-amber-200" />
                  <span className="text-xs text-amber-500 font-semibold">
                    {postponedTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {postponedTasks.map((t) => (
                    <PostponedTaskItem key={t.id} task={t} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Postpone Modal */}
      {postponeTask && (
        <PostponeModal task={postponeTask} onClose={() => setPostponeTask(null)} />
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
