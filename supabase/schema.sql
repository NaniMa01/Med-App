-- Im Supabase SQL Editor ausführen.

create table if not exists public.medical_cases (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    case_id text not null,
    title text,
    medical_field text,
    case_data jsonb not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, case_id)
);

create table if not exists public.user_progress (
    user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
    xp integer default 0,
    solved_cases jsonb default '[]',
    skills jsonb default '{}',
    updated_at timestamptz default now()
);

alter table public.medical_cases enable row level security;
alter table public.user_progress enable row level security;

drop policy if exists "medical_cases_select_own" on public.medical_cases;
drop policy if exists "medical_cases_insert_own" on public.medical_cases;
drop policy if exists "medical_cases_update_own" on public.medical_cases;
drop policy if exists "medical_cases_delete_own" on public.medical_cases;

create policy "medical_cases_select_own" on public.medical_cases
    for select to authenticated using (user_id = auth.uid());
create policy "medical_cases_insert_own" on public.medical_cases
    for insert to authenticated with check (user_id = auth.uid());
create policy "medical_cases_update_own" on public.medical_cases
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "medical_cases_delete_own" on public.medical_cases
    for delete to authenticated using (user_id = auth.uid());

drop policy if exists "user_progress_select_own" on public.user_progress;
drop policy if exists "user_progress_insert_own" on public.user_progress;
drop policy if exists "user_progress_update_own" on public.user_progress;
drop policy if exists "user_progress_delete_own" on public.user_progress;

create policy "user_progress_select_own" on public.user_progress
    for select to authenticated using (user_id = auth.uid());
create policy "user_progress_insert_own" on public.user_progress
    for insert to authenticated with check (user_id = auth.uid());
create policy "user_progress_update_own" on public.user_progress
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_progress_delete_own" on public.user_progress
    for delete to authenticated using (user_id = auth.uid());
