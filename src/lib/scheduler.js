/**
 * Task Scheduling Engine
 *
 * Converts master tasks into dated instances based on frequency rules.
 * Called once per day (idempotent — safe to call multiple times).
 */

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Returns today's date as "YYYY-MM-DD" string.
 */
export function getTodayString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns a human-readable date string, e.g. "Monday, June 6"
 */
export function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Converts "HH:MM" (24h) to "h:MM AM/PM"
 */
export function formatTime(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Compares two "HH:MM" time strings for sorting.
 */
export function compareTime(a, b) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}

/**
 * Determines if a master task should appear on the given date.
 */
export function shouldTaskRunOn(task, date = new Date()) {
  switch (task.frequency) {
    case "daily":
      return true;

    case "weekly": {
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
      return Array.isArray(task.daysOfWeek) && task.daysOfWeek.includes(dayOfWeek);
    }

    case "monthly": {
      const dayOfMonth = date.getDate(); // 1–31
      // Support both single date and array of dates
      if (Array.isArray(task.daysOfMonth)) {
        return task.daysOfMonth.includes(dayOfMonth);
      }
      return task.dateOfMonth === dayOfMonth;
    }

    default:
      return false;
  }
}

/**
 * Core function: generates today's task instances from master tasks.
 * Idempotent — checks if instances already exist before writing.
 *
 * @param {Date} date - The date to generate tasks for (default: today)
 * @returns {Promise<{ created: number, skipped: number }>}
 */
export async function generateDayInstances(date = new Date()) {
  const dateStr = getTodayString(date);

  // Check if today's instances already exist (prevent duplicates)
  const existingSnap = await getDocs(
    query(collection(db, "taskInstances"), where("date", "==", dateStr))
  );
  if (!existingSnap.empty) {
    return { created: 0, skipped: existingSnap.size };
  }

  // Fetch all active master tasks
  const masterSnap = await getDocs(
    query(collection(db, "masterTasks"), where("active", "==", true))
  );
  const masterTasks = masterSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Filter and create instances
  let created = 0;
  for (const task of masterTasks) {
    if (!shouldTaskRunOn(task, date)) continue;

    await addDoc(collection(db, "taskInstances"), {
      masterTaskId: task.id,
      title: task.title,
      date: dateStr,
      time: task.time,
      status: "pending",
      completedAt: null,
      createdAt: serverTimestamp(),
    });
    created++;
  }

  return { created, skipped: 0 };
}

/**
 * Returns stats for a given date range.
 * Used by the admin analytics panel.
 */
export async function getAnalytics(days = 7) {
  const results = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = getTodayString(d);

    const snap = await getDocs(
      query(collection(db, "taskInstances"), where("date", "==", dateStr))
    );

    const instances = snap.docs.map((doc) => doc.data());
    const total = instances.length;
    const done = instances.filter((t) => t.status === "done").length;

    results.push({
      date: dateStr,
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      total,
      done,
      rate: total > 0 ? Math.round((done / total) * 100) : 0,
    });
  }

  return results;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
