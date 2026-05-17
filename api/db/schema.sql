-- xrpl_mobile schema
-- Apply this in the new Supabase project's SQL editor.
-- Service role bypasses RLS by design; mobile clients NEVER hit these tables directly.

-- =========================================
-- Extensions
-- =========================================
create extension if not exists pgcrypto;

-- =========================================
-- Enums
-- =========================================
do $$ begin
  create type role_type as enum ('USER', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wallet_type as enum ('user', 'issuer', 'treasury');
exception when duplicate_object then null; end $$;

do $$ begin
  create type friend_request_status as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null; end $$;

-- =========================================
-- profiles
-- One row per authenticated user (id mirrors auth.users.id).
-- =========================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text not null,
  role role_type not null default 'USER',
  created_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

-- =========================================
-- wallets
-- Custodial XRPL wallets. Seeds are encrypted with pgp_sym_encrypt(seed, key).
-- The encryption key lives only in the API env (SEED_ENCRYPTION_KEY).
-- =========================================
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  classic_address text not null unique,
  wallet_type wallet_type not null default 'user',
  encrypted_seed text not null,
  created_at timestamptz not null default now()
);

create index if not exists wallets_user_id_idx on public.wallets (user_id);
create index if not exists wallets_wallet_type_idx on public.wallets (wallet_type);

-- =========================================
-- amms
-- Registry of AMM pools created via this app.
-- =========================================
create table if not exists public.amms (
  id uuid primary key default gen_random_uuid(),
  account text not null unique,
  currency1 text not null,
  currency2 text not null,
  issuer_address text not null,
  treasury_address text not null,
  created_at timestamptz not null default now()
);

-- =========================================
-- friend_requests
-- =========================================
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status friend_request_status not null default 'pending',
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_distinct check (sender_id <> receiver_id)
);

create index if not exists friend_requests_sender_idx on public.friend_requests (sender_id);
create index if not exists friend_requests_receiver_idx on public.friend_requests (receiver_id);

-- =========================================
-- favorites
-- =========================================
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  constraint favorites_distinct check (user_id <> friend_id)
);

-- =========================================
-- nfts_meta (optional cache)
-- =========================================
create table if not exists public.nfts_meta (
  nft_id text primary key,
  owner_address text not null,
  metadata jsonb,
  listed_price text,
  created_at timestamptz not null default now()
);

-- =========================================
-- Encryption helper RPCs
-- Called from the API with the symmetric key from env (SEED_ENCRYPTION_KEY).
-- The key is never stored in the database.
-- =========================================
create or replace function public.encrypt_seed_v1(p_plaintext text, p_key text)
returns text
language sql
security definer
as $$
  -- Encrypt and hex-encode for clean transport.
  select encode(pgp_sym_encrypt(p_plaintext, p_key), 'hex');
$$;

create or replace function public.decrypt_seed_v1(p_ciphertext text, p_key text)
returns text
language sql
security definer
as $$
  select pgp_sym_decrypt(decode(p_ciphertext, 'hex'), p_key);
$$;

-- Restrict execution to service role.
revoke all on function public.encrypt_seed_v1(text, text) from public, anon, authenticated;
revoke all on function public.decrypt_seed_v1(text, text) from public, anon, authenticated;
grant execute on function public.encrypt_seed_v1(text, text) to service_role;
grant execute on function public.decrypt_seed_v1(text, text) to service_role;

-- =========================================
-- RLS
-- Default deny. Service role (used by api/) bypasses RLS.
-- =========================================
alter table public.profiles         enable row level security;
alter table public.wallets          enable row level security;
alter table public.amms             enable row level security;
alter table public.friend_requests  enable row level security;
alter table public.favorites        enable row level security;
alter table public.nfts_meta        enable row level security;

-- No policies are created; without policies, only service_role can read/write.
-- If you ever expose direct PostgREST access to mobile clients, add tight policies here.
