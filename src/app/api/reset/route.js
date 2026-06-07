import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const deleteAll = async (collectionName) => {
      const snap = await getDocs(collection(db, collectionName));
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, collectionName, d.id))));
      return snap.size;
    };

    const [tasks, instances] = await Promise.all([
      deleteAll("masterTasks"),
      deleteAll("taskInstances"),
    ]);

    return NextResponse.json({
      success: true,
      deleted: { masterTasks: tasks, taskInstances: instances },
      message: `Deleted ${tasks} master tasks and ${instances} instances. Now visit /api/seed to re-seed.`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
