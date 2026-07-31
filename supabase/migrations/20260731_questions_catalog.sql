-- Terravox: catálogo interno de perguntas.
-- As credenciais de serviço devem ficar somente no ambiente do servidor.

create extension if not exists pgcrypto;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  external_source varchar(50) not null,
  external_id varchar(100),
  category varchar(100) not null,
  subcategory varchar(100),
  question_original text,
  question_pt_br text not null,
  correct_answer_original text,
  correct_answer_pt_br text not null,
  incorrect_answers_original jsonb not null default '[]'::jsonb,
  incorrect_answers_pt_br jsonb not null default '[]'::jsonb,
  difficulty varchar(20) not null default 'easy',
  question_type varchar(20) not null default 'multiple',
  explanation_pt_br text,
  age_group varchar(30),
  tags jsonb not null default '[]'::jsonb,
  source_url text,
  source_license varchar(100),
  translation_status varchar(30) not null default 'pending',
  review_status varchar(30) not null default 'pending',
  is_active boolean not null default false,
  content_hash varchar(64) not null,
  imported_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_difficulty_check check (difficulty in ('easy', 'medium', 'hard')),
  constraint questions_type_check check (question_type in ('multiple', 'boolean')),
  constraint questions_translation_check check (translation_status in ('pending', 'translated', 'reviewed')),
  constraint questions_review_check check (review_status in ('pending', 'approved', 'rejected')),
  constraint questions_source_hash_unique unique (external_source, content_hash)
);

create index if not exists questions_active_category_difficulty_idx
  on public.questions (category, difficulty)
  where is_active = true;

create index if not exists questions_review_queue_idx
  on public.questions (review_status, translation_status, imported_at desc);

create table if not exists public.question_import_runs (
  id uuid primary key default gen_random_uuid(),
  source varchar(50) not null,
  requested_amount integer not null,
  category varchar(100),
  difficulty varchar(20),
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  status varchar(30) not null default 'running',
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references auth.users(id)
);

create table if not exists public.question_import_errors (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.question_import_runs(id) on delete cascade,
  external_payload jsonb,
  error_code varchar(60),
  error_message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

-- Não crie políticas de leitura para anon/authenticated nesta tabela.
-- A resposta correta permanece no servidor, que expõe ao jogo somente alternativas embaralhadas.
alter table public.questions enable row level security;
alter table public.question_import_runs enable row level security;
alter table public.question_import_errors enable row level security;
