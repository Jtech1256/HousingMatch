# RoomieMatch

Swipe-to-match roommate finder for college students. ("RoomieMatch" is a placeholder name — change it in `app.json`.)

**What works right now**
- Sign in with a `.edu` email (a one-time code is emailed, no passwords)
- Create a profile: photo, major, budget, move-in date, on/off campus, places, interests
- 8-question living-style quiz (sleep, cleanliness, guests, noise…)
- Swipe deck that only shows people who fit your budget, dates, housing, and gender preference, sorted by a 0–100% match score
- Mutual like → "It's a match!" → live chat
- Unmatch, block, and report

**Built with:** React Native + Expo (the app), Supabase (accounts, database, photo storage, live chat).

---

## Setup (about 20 minutes, do it together the first time)

### 1. Install the tools
- Install **Node.js** (LTS version) from https://nodejs.org
- Install **Expo Go** on your phone from the App Store / Play Store
- In a terminal, inside this folder, run:
  ```bash
  npm install
  ```

### 2. Create your Supabase project
1. Go to https://supabase.com, sign up, and click **New project** (the free plan is fine).
2. When it's ready, open **SQL Editor → New query**, paste in all of `supabase/schema.sql`, and click **Run**. This creates every table, the security rules, and the matching logic.
3. Go to **Project Settings → API Keys** (or the **Connect** button) and copy the **Project URL** and the **publishable key**.
4. In this folder, copy `.env.example` to a new file named `.env.local` and paste those two values in. (`.env.local` is git-ignored, so it won't end up on GitHub.)

### 3. Make sign-in emails send a code
By default Supabase emails a link, but the app asks for a code.
1. Go to **Authentication → Emails → Templates → Magic Link**.
2. Replace the body with something like:
   ```html
   <h2>Your RoomieMatch code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
3. Save. (Do the same for the **Confirm signup** template so brand-new users get a code too.)

> Supabase's built-in email sender only allows a few emails per hour — fine for the two of you testing, not for launch. Before real users, hook up a free email service (like Resend) under **Authentication → Emails → SMTP Settings**.

### 4. Run it
```bash
npx expo start
```
Scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android). Your phone and computer need to be on the same Wi-Fi — if VT's network blocks it, run `npx expo start --tunnel` instead.

### 5. Test matching with two accounts
You each sign in on your own phone with your VT email, fill out a profile with **overlapping budgets and move-in dates**, take the quiz, and swipe right on each other. You should both get the match screen and be able to chat.

---

## How the code is organized

```
src/
  app/                    ← every file here is a screen (Expo Router)
    _layout.tsx           ← decides which screens you can see (signed in? profile done?)
    sign-in.tsx           ← email + code login
    setup.tsx             ← create / edit profile (+ photo upload)
    quiz.tsx              ← living-style quiz
    (tabs)/               ← the 3 bottom tabs
      _layout.tsx         ← tab bar
      index.tsx           ← Discover: the swipe deck
      matches.tsx         ← list of matches
      profile.tsx         ← your profile, sign out
    chat/[id].tsx         ← chat with one match ([id] = the match id)
  components/
    SwipeCard.tsx         ← the draggable card
    ui.tsx                ← buttons, inputs, chips, colors
  lib/
    supabase.ts           ← connection to your database
    auth.tsx              ← who's signed in + their profile, shared with every screen
    options.ts            ← quiz questions, interests, VT dorms/complexes  ← easy to edit!
    types.ts              ← TypeScript shapes of the data
supabase/
  schema.sql              ← the whole database
```

**Where to start reading:** `src/app/_layout.tsx` → `src/app/(tabs)/index.tsx` → `src/components/SwipeCard.tsx`.

## How matching works

All in `get_candidates` at the bottom of `supabase/schema.sql`:

1. **Hard filters** — you only see someone if *all* of these are true: same school (from email domain), compatible housing type, budgets overlap, move-in dates within 45 days, you share at least one place (if both of you picked places), the gender preference works for **both** people, you haven't swiped on them yet, and nobody blocked anybody.
2. **Score** — compares the 8 quiz answers. Identical answers = 100%, opposite on everything = 0%. Then +2 per shared interest and +5 for a shared place, capped at 100.

When you like someone who already liked you, the database creates the match automatically (`create_match_on_mutual_like`).

## Security, in plain English

Your Supabase key is inside the app, so anyone could technically use it. What actually protects the data is **Row Level Security** — rules in `schema.sql` that the database enforces no matter what the app does:
- Only `.edu` emails can make a profile, and you only see students at your own school
- You can only read your own swipes, and only chat inside your own matches
- People who blocked you (or you blocked) disappear completely

If you add a new table later, **always** add `enable row level security` and policies for it.

## Splitting the work

A natural split while you learn:
- **Person A — screens:** styling, the swipe card feel, the onboarding flow, empty states
- **Person B — data:** `schema.sql`, the matching formula, chat, safety features

Use GitHub so you're not emailing files: one of you creates a repo, pushes this folder, and the other clones it. Work on separate branches and merge with pull requests.

## Ideas for next steps

1. A real date picker for move-in (e.g. `@react-native-community/datetimepicker`)
2. "Last message" preview and unread dots on the Matches tab
3. Push notifications for new matches and messages (`expo-notifications`)
4. Subleasing tab: listings with dates, rent, and photos
5. Group matching (a pair looking for 2 more)

## Starting the database over

In the SQL Editor, run:
```sql
drop table if exists public.reports, public.blocks, public.messages, public.matches, public.swipes, public.profiles cascade;
drop function if exists public.get_candidates, public.my_school, public.is_blocked,
  public.remove_match_on_block, public.create_match_on_mutual_like, public.set_school_domain cascade;
drop policy if exists "upload own avatar" on storage.objects;
drop policy if exists "replace own avatar" on storage.objects;
```
then run `schema.sql` again.
