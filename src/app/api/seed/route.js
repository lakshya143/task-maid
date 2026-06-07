import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NextResponse } from "next/server";

const MASTER_TASKS = [
  // ─── DAILY TASKS ────────────────────────────────────────────────────────────
  { title: "RO टैंक खाली करना (RO पानी से बर्तन धुल सकें)", frequency: "daily", time: "08:00" },
  { title: "किचन: सारे बर्तन इकट्ठा करके खाली करना + सिंक/वॉश के लिए ready रखना", frequency: "daily", time: "08:05" },
  { title: "किचन: स्लैब साफ करना + सामान सही जगह रखना", frequency: "daily", time: "08:10" },
  { title: "किचन: गैस स्टोव बेसिक साफ करना", frequency: "daily", time: "08:15" },
  { title: "हॉल: सोफा से बेडशीट/दोहर/रनर हटाकर दोबारा जमाना", frequency: "daily", time: "08:20" },
  { title: "हॉल: सोफा के कुशन फटकारना + वापस सही से जमाना", frequency: "daily", time: "08:25" },
  { title: "डाइनिंग: टेबल + ट्रे अच्छे से साफ करना", frequency: "daily", time: "08:30" },
  { title: "डाइनिंग: रनर फटकारना/साफ करना + वापस सही से बिछाना", frequency: "daily", time: "08:35" },
  { title: "हॉल: सेंटर टेबल + TV यूनिट + साइड टेबल वाइप/डस्टिंग", frequency: "daily", time: "08:40" },
  { title: "हॉल: डेकोरेशन आइटम/फ्रेम/शोपिस पोंछना", frequency: "daily", time: "08:45" },
  { title: "हॉल: घेयर्स पोंछना + यूनिट/कबर्ड क्विक वाइप", frequency: "daily", time: "08:50" },
  { title: "इंडोर प्लांट्स में पानी देना (पोछा लगने से पहले)", frequency: "daily", time: "08:55" },
  { title: "एंट्री: शू-रैक साफ करना + जूते व्यवस्थित करना", frequency: "daily", time: "09:00" },
  { title: "गेट/एंट्रेस रेलिंग साफ करना + सिटिंग एरिया साफ करना", frequency: "daily", time: "09:05" },
  { title: "बालकनी: रेलिंग साफ करना + बालकनी के पौधों में पानी देना", frequency: "daily", time: "09:10" },
  { title: "साइकिल/बाहर की क्विक क्लीनिंग (सामने वाली)", frequency: "daily", time: "09:15" },
  { title: "स्टूडियो: कांच/ग्लास सतहें + खिड़कियाँ साफ करना", frequency: "daily", time: "09:20" },
  { title: "स्टूडियो: फ्रेम/डेकोर आइटम पोंछना", frequency: "daily", time: "09:25" },
  { title: "स्टूडियो: टेबल्स क्विक वाइप + फर्नीचर का quick tidy (सामान हटाकर वापस जमाना)", frequency: "daily", time: "09:28" },
  { title: "चाय बनाना + दूध गरम करना", frequency: "daily", time: "09:30" },
  { title: "मम्मी के साथ नाश्ता तैयार करना + सर्व करना", frequency: "daily", time: "09:45" },
  { title: "Siren एरिया पूरी तरह साफ करना (फीडिंग एरिया + आसपास)", frequency: "daily", time: "10:00" },
  { title: "ऊपर वाली सीढ़ियों के नीचे cupboard top पोंछना + रेलिंग साफ करना", frequency: "daily", time: "10:05" },
  { title: "स्मॉल टेरेस: पेड़/पौधों में पानी देना", frequency: "daily", time: "10:10" },
  { title: "धानी रूम बालकनी के पौधे + बाकी इंडोर पौधे चेक करके पानी देना", frequency: "daily", time: "10:15" },
  { title: "स्मॉल टेरेस का फर्नीचर (कुर्सी/टेबल) अच्छे से पोंछना", frequency: "daily", time: "10:20" },
  { title: "मम्मी के लिए गरम पानी तैयार करना", frequency: "daily", time: "10:25" },
  { title: "मम्मी के लिए गीज़र ऑन करना + बाल्टी भरना", frequency: "daily", time: "10:30" },
  { title: "राखी रूम + धानी रूम डीप क्लीनिंग शुरू करना", frequency: "daily", time: "10:35" },
  { title: "बेडशीट हटाना/बदलना + वॉश के लिए रखना / वापस सही से जमाना", frequency: "daily", time: "10:40" },
  { title: "दोनों कमरों की टेबल्स + ड्रेसिंग टेबल पोंछना", frequency: "daily", time: "10:50" },
  { title: "धानी रूम: खिलौने जमाना + मार्कर/पेन कैप बंद + स्टेशनरी री-अरेंज", frequency: "daily", time: "11:00" },
  { title: "दोनों कमरों का सामान वापस सही जगह पर रखना", frequency: "daily", time: "11:10" },
  { title: "सभी कमरों के डोरमैट्स वापस सही जगह लगाना", frequency: "daily", time: "11:15" },
  { title: "हिले हुए फर्नीचर/रनर/कुशन का फाइनल सेट करना", frequency: "daily", time: "11:20" },
  { title: "सभी डस्टबिन इकट्ठा करके मेन डस्टबिन में डालना", frequency: "daily", time: "11:25" },
  { title: "जहाँ जरूरी हो डस्टबिन धोना/साफ करना", frequency: "daily", time: "11:30" },
  { title: "सभी पानी की बोतलें धोकर रिफिल करना (दिन के लिए तैयार)", frequency: "daily", time: "11:35" },
  { title: "आउटडोर पौधों में पानी देना + पत्ते/एरिया neat करना", frequency: "daily", time: "11:40" },
  { title: "कार पानी से धोना", frequency: "daily", time: "11:45" },
  { title: "कार wet cloth से पोंछना", frequency: "daily", time: "11:50" },
  { title: "कार dry cloth से पोंछना", frequency: "daily", time: "11:55" },
  { title: "कार floor mats साफ करना + कार dashboard साफ करना + कार डस्टबिन खाली करना", frequency: "daily", time: "12:00" },
  { title: "बाइक धोना + स्कूटी धोना + 3 साइकिल साफ करना", frequency: "daily", time: "12:05" },
  { title: "बाथरूम: मम्मी का बाथरूम साफ करना", frequency: "daily", time: "12:10" },
  { title: "बाथरूम: स्टूडियो का बाथरूम साफ करना", frequency: "daily", time: "12:15" },
  { title: "बाथरूम: स्मॉल टेरेस का बेसिन साफ करना", frequency: "daily", time: "12:20" },
  { title: "Siren litter चेक — गंदी हो तो साफ करना", frequency: "daily", time: "12:25" },
  { title: "3:00–4:30 के बीच pending/adhoc काम निपटाना", frequency: "daily", time: "15:00" },
  { title: "शाम की चाय बनाना", frequency: "daily", time: "16:30" },
  { title: "घर के सभी बर्तन collect करके सिंक में रखना (Evening maid के लिए)", frequency: "daily", time: "16:40" },
  { title: "Rakhi + Dhani Dance class drop", frequency: "daily", time: "17:20" },
  { title: "ग्लास सतहें quick wipe (doors/windows/mirrors)", frequency: "daily", time: "17:30" },
  { title: "Doors clean करना (अगर Dhani ने लिखा हो)", frequency: "daily", time: "17:40" },
  { title: "Railing quick clean (spot wipe)", frequency: "daily", time: "17:50" },
  { title: "Evening gallery की light जलाना", frequency: "daily", time: "18:00" },
  { title: "Fridge thorough wipe (outer + handle + top)", frequency: "daily", time: "18:05" },
  { title: "Rakhi + Dhani pickup from dance class", frequency: "daily", time: "18:30" },
  { title: "Water bottles check (Night closing)", frequency: "daily", time: "19:35" },
  { title: "Wet garbage colony से बाहर फेंकना + dustbin धोकर वापस रखना", frequency: "daily", time: "19:40" },
  { title: "Siren final food check + water refill", frequency: "daily", time: "19:45" },

  // ─── WEEKLY — MONDAY ────────────────────────────────────────────────────────
  { title: "फ्रिज की पुरानी सब्जियाँ मम्मी/राखी से पूछकर हटाना", frequency: "weekly", time: "15:00", daysOfWeek: [1] },
  { title: "फ्रिज अंदर–बाहर साफ करना", frequency: "weekly", time: "15:10", daysOfWeek: [1] },
  { title: "माइक्रोवेव साफ करना", frequency: "weekly", time: "15:20", daysOfWeek: [1] },
  { title: "फ्रिज में सब्जियाँ व्यवस्थित करना", frequency: "weekly", time: "15:30", daysOfWeek: [1] },

  // ─── WEEKLY — TUESDAY ───────────────────────────────────────────────────────
  { title: "Rakhi room bedsheet बदलना", frequency: "weekly", time: "15:00", daysOfWeek: [2] },
  { title: "Dhani room bedsheet बदलना", frequency: "weekly", time: "15:10", daysOfWeek: [2] },
  { title: "Mother room bedsheet बदलना", frequency: "weekly", time: "15:20", daysOfWeek: [2] },
  { title: "सभी sheets washing machine में wash करना", frequency: "weekly", time: "15:30", daysOfWeek: [2] },
  { title: "Siren litter clean करना (Tuesday)", frequency: "weekly", time: "15:45", daysOfWeek: [2] },

  // ─── WEEKLY — WEDNESDAY ─────────────────────────────────────────────────────
  { title: "Rakhi drum cloth wash करना", frequency: "weekly", time: "15:00", daysOfWeek: [3] },
  { title: "घर के सभी doors wipe करना", frequency: "weekly", time: "15:15", daysOfWeek: [3] },
  { title: "Name plate wipe करना", frequency: "weekly", time: "15:30", daysOfWeek: [3] },
  { title: "Name plate के पास outside tiles/wall clean करना", frequency: "weekly", time: "15:40", daysOfWeek: [3] },

  // ─── WEEKLY — THURSDAY ──────────────────────────────────────────────────────
  { title: "Fridge से पुरानी सब्जियाँ मम्मी/राखी से पूछकर हटाना", frequency: "weekly", time: "15:00", daysOfWeek: [4] },
  { title: "फ्रिज अंदर–बाहर साफ करना (Thursday)", frequency: "weekly", time: "15:15", daysOfWeek: [4] },

  // ─── WEEKLY — FRIDAY ────────────────────────────────────────────────────────
  { title: "Mummy + Rakhi से कपड़े लेना + सभी कपड़े प्रेस करना", frequency: "weekly", time: "15:00", daysOfWeek: [5] },
  { title: "Siren litter clean करना (Friday)", frequency: "weekly", time: "15:30", daysOfWeek: [5] },

  // ─── WEEKLY — SATURDAY ──────────────────────────────────────────────────────
  { title: "Roti के कपड़े + kitchen के कपड़े wash करना", frequency: "weekly", time: "15:00", daysOfWeek: [6] },
  { title: "Mummy drum cloth wash करना", frequency: "weekly", time: "15:15", daysOfWeek: [6] },
  { title: "Kitchen cabinet/cupboards deep clean (सामान निकालकर साफ करके जमाना)", frequency: "weekly", time: "15:30", daysOfWeek: [6] },
  { title: "Kitchen cupboards के doors wipe करना", frequency: "weekly", time: "15:50", daysOfWeek: [6] },
  { title: "Kitchen utensils साफ करके दोबारा जमाना", frequency: "weekly", time: "16:00", daysOfWeek: [6] },

  // ─── MONTHLY — 15th ─────────────────────────────────────────────────────────
  { title: "चक्की साफ करना", frequency: "monthly", time: "10:00", daysOfMonth: [15] },
  { title: "गेहूँ पिसवाना", frequency: "monthly", time: "10:30", daysOfMonth: [15] },
  { title: "पंखे साफ करना", frequency: "monthly", time: "11:00", daysOfMonth: [15] },

  // ─── MONTHLY — 1st ──────────────────────────────────────────────────────────
  { title: "सारे floors के soap dispensers refill करना", frequency: "monthly", time: "10:00", daysOfMonth: [1] },
  { title: "Washing machine deep clean + inlet pipe calcium remove + powder cycle run", frequency: "monthly", time: "11:00", daysOfMonth: [1] },
];

export async function GET() {
  try {
    // Guard: don't seed if masterTasks already has data
    const existing = await getDocs(collection(db, "masterTasks"));
    if (!existing.empty) {
      return NextResponse.json(
        { error: "Tasks already exist. Delete them in Admin first, then re-seed." },
        { status: 400 }
      );
    }

    let count = 0;
    for (const task of MASTER_TASKS) {
      await addDoc(collection(db, "masterTasks"), {
        ...task,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
    }

    return NextResponse.json({
      success: true,
      message: `✅ ${count} tasks seeded successfully!`,
      breakdown: {
        daily: MASTER_TASKS.filter((t) => t.frequency === "daily").length,
        weekly: MASTER_TASKS.filter((t) => t.frequency === "weekly").length,
        monthly: MASTER_TASKS.filter((t) => t.frequency === "monthly").length,
      },
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
