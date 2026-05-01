-- Slet al app-data (i rækkefølge for at undgå konflikter)
DELETE FROM public.daily_logs;
DELETE FROM public.activity_assignments;
DELETE FROM public.activities;
DELETE FROM public.attendance_records;
DELETE FROM public.day_status;
DELETE FROM public.employee_time_logs;
DELETE FROM public.children;
DELETE FROM public.categories;
DELETE FROM public.organization_invites;
DELETE FROM public.organization_members;
DELETE FROM public.organizations;
DELETE FROM public.profiles;

-- Slet alle auth-brugere
DELETE FROM auth.users;