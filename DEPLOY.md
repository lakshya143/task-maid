# Deployment Guide — Task Maid

## Stack
- **Frontend**: Next.js 14 (PWA via @ducanh2912/next-pwa)
- **Database**: Firebase Firestore
- **Hosting**: Vercel (free tier)

---

## Step 1 — Firebase Setup

### 1.1 Create project
1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `task-maid` → Continue
3. Disable Google Analytics (optional) → Create project

### 1.2 Create Firestore database
1. In left sidebar → **Firestore Database** → Create database
2. Choose **Production mode** → select your region → Enable

### 1.3 Set Firestore security rules
Go to **Firestore → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All reads/writes from your app are allowed
    // (the app uses password auth, not Firebase Auth)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ This is fine for a private personal app. For a public app, add proper auth rules.

### 1.4 Get your Firebase config
1. Project Settings (gear icon) → **Your apps** → click **</>** (Web)
2. Register app with any nickname
3. Copy the `firebaseConfig` object values

---

## Step 2 — Local Setup

```bash
# Clone / open the project folder
cd "task manager maid"

# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

NEXT_PUBLIC_GOPAL_PASSWORD=gopal123
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
```

```bash
# Run locally
npm run dev
# Visit http://localhost:3000
```

---

## Step 3 — Vercel Deployment

### 3.1 Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/task-maid.git
git push -u origin main
```

### 3.2 Deploy on Vercel
1. Go to https://vercel.com → New Project
2. Import your GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Add all environment variables from `.env.local` in **Environment Variables** section
5. Click **Deploy**

### 3.3 Set your domain (optional)
In Vercel → Project → Settings → Domains → add a custom domain.

---

## Step 4 — Install PWA on iPhone

1. Open your Vercel URL in **Safari on iPhone**
2. Tap the **Share** button (box with arrow)
3. Scroll down → **Add to Home Screen**
4. Tap **Add**
5. The app launches fullscreen like a native app

---

## Data Models Reference

### `masterTasks` collection
```js
{
  title: "Morning Walk",        // string
  frequency: "daily",           // "daily" | "weekly" | "monthly"
  time: "07:00",                // "HH:MM" 24-hour
  daysOfWeek: [1, 3, 5],       // for weekly: 0=Sun...6=Sat
  daysOfMonth: [1, 15],        // for monthly: 1-31
  active: true,                 // boolean
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `taskInstances` collection
```js
{
  masterTaskId: "abc123",       // reference to masterTasks doc
  title: "Morning Walk",        // denormalized for display
  date: "2026-06-06",          // "YYYY-MM-DD"
  time: "07:00",                // "HH:MM"
  status: "pending",            // "pending" | "done"
  completedAt: Timestamp|null,
  createdAt: Timestamp
}
```

---

## Seeding Sample Tasks (Optional)

Run this in your browser console (from the deployed app or localhost) after logging in as admin. Open DevTools → Console:

```js
// Paste into browser console at your app URL
import('/src/lib/firebase.js').then(async ({ db }) => {
  const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
  const tasks = [
    { title: "Morning Walk", frequency: "daily", time: "07:00", active: true },
    { title: "Take Medicine", frequency: "daily", time: "09:00", active: true },
    { title: "Drink Water", frequency: "daily", time: "08:30", active: true },
    { title: "Evening Walk", frequency: "weekly", time: "18:00", daysOfWeek: [1,3,5], active: true },
    { title: "Weekly Review", frequency: "weekly", time: "10:00", daysOfWeek: [0], active: true },
    { title: "Pay Bills", frequency: "monthly", time: "10:00", daysOfMonth: [1], active: true },
  ];
  for (const t of tasks) {
    await addDoc(collection(db, 'masterTasks'), { ...t, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  console.log('Tasks seeded!');
});
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Firebase not initialized" | Check all `NEXT_PUBLIC_FIREBASE_*` env vars are set |
| "No tasks today" | Use Admin → Today tab → click Regenerate |
| PWA not installing | Must be served over HTTPS (Vercel handles this) |
| Tasks not appearing | Check Firestore → taskInstances collection, verify `active: true` on masterTasks |
