export const dynamic = "force-dynamic";

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  deleteField,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find all postponed instances older than 7 days
    const q = query(
      collection(db, "taskInstances"),
      where("postponedAt", "<", Timestamp.fromDate(sevenDaysAgo))
    );

    const snap = await getDocs(q);

    // Remove the audio field from each (no-op if field doesn't exist)
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(doc(db, "taskInstances", d.id), {
          postponeAudioBase64: deleteField(),
        })
      )
    );

    return NextResponse.json({
      success: true,
      cleaned: snap.size,
      message: `Cleared audio from ${snap.size} postponed instance(s) older than 7 days.`,
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
