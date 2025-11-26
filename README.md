# Safe Work System (Permits & Inspections)

A Next.js 14 app with Supabase backend for Safe Work Permits and Field Safety Inspections.
- Role-based access (`profiles.role`): `admin`, `permit_writer`, `inspector`
- Landing dashboard → choose Permit System or Inspections
- New forms open in new browser window (as requested)
- After submission, a **print-friendly window** opens automatically

## 1) Prereqs
- Supabase project
- Vercel account
- GitHub repo

## 2) Supabase Setup
1. In Supabase SQL editor, run `supabase/database.sql` (copy contents).
2. In **Auth → Users**, create your account; then add a row in `profiles` with your user id and desired `role`.
3. (Optional) Seed some data.

## 3) Environment Variables (Vercel)
In Vercel Project Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key

## 4) Deploy
1. Push this project to GitHub.
2. Import repo in Vercel and deploy.
3. Visit `/auth/signup` to create user (defaults to `inspector`).  
   Update your role in Supabase `profiles` table as needed:
   - Admin can see both systems
   - Permit Writer can create/view permits
   - Inspector can create/view inspections

## Notes
- Completed inspections are **read-only**.
- Printing mirrors the form layout using table sections.
- Later you can move hardcoded options to a config table or JSON and fetch them.
