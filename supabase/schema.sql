-- ==============================================================================
-- SOBRA - CONTROLE FINANCEIRO: ESQUEMA DO SUPABASE PARA CONTAS CONJUNTAS
-- Execute este script no SQL Editor do seu projeto Supabase (supabase.com)
-- Pode ser re-executado com segurança (usa IF NOT EXISTS e OR REPLACE)
-- ==============================================================================

-- 1. Perfis de Usuários vinculados ao Supabase Auth
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS nos perfis
alter table public.profiles enable row level security;

-- Remove políticas antigas antes de recriar (evita conflitos)
drop policy if exists "Perfis públicos legíveis por usuários autenticados" on public.profiles;
drop policy if exists "Usuários podem atualizar seus próprios perfis" on public.profiles;

create policy "Perfis públicos legíveis por usuários autenticados" 
  on public.profiles for select 
  using (auth.role() = 'authenticated');

create policy "Usuários podem atualizar seus próprios perfis" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Trigger para criar perfil automaticamente quando um usuário faz login com Google
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Tabela de Códigos de Convite de Cartões Compartilhados
create table if not exists public.card_invites (
  code text primary key,
  account_id text not null,
  account_name text not null,
  owner_id text not null,
  owner_name text not null,
  bank_id text,
  color text,
  credit_limit numeric,
  type text default 'credit_card',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.card_invites enable row level security;

-- Remove políticas antigas antes de recriar
drop policy if exists "Convites legíveis por qualquer usuário autenticado" on public.card_invites;
drop policy if exists "Criadores podem cadastrar convites" on public.card_invites;
drop policy if exists "Convites são públicos para leitura" on public.card_invites;
drop policy if exists "Usuários autenticados podem criar convites" on public.card_invites;
drop policy if exists "Dono pode atualizar seu convite" on public.card_invites;
drop policy if exists "Convites podem ser atualizados pelo dono" on public.card_invites;

-- CORREÇÃO CRÍTICA: Leitura pública para que qualquer pessoa possa buscar
-- um convite pelo código, sem precisar estar logada
create policy "Convites são públicos para leitura"
  on public.card_invites for select
  using (true);

-- Apenas usuários autenticados podem criar convites
create policy "Usuários autenticados podem criar convites"
  on public.card_invites for insert
  with check (auth.role() = 'authenticated');

-- Apenas o dono pode atualizar seu convite
create policy "Dono pode atualizar seu convite"
  on public.card_invites for update
  using (auth.uid()::text = owner_id);

-- 3. Tabela de Membros Vinculados a Cartões Compartilhados
create table if not exists public.shared_account_members (
  id uuid default gen_random_uuid() primary key,
  account_id text not null,
  user_id text not null,
  display_name text not null,
  email text,
  role text default 'member',
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (account_id, user_id)
);

alter table public.shared_account_members enable row level security;

drop policy if exists "Membros podem ver vínculos de suas contas" on public.shared_account_members;
drop policy if exists "Usuários podem se vincular via convite" on public.shared_account_members;
drop policy if exists "Usuários autenticados podem se vincular via convite" on public.shared_account_members;

create policy "Membros podem ver vínculos de suas contas"
  on public.shared_account_members for select
  using (true);

create policy "Usuários autenticados podem se vincular via convite"
  on public.shared_account_members for insert
  with check (auth.role() = 'authenticated');

-- 4. Tabela de Transações Compartilhadas
create table if not exists public.shared_transactions (
  id text primary key,
  account_id text not null,
  category_id text,
  amount numeric not null,
  type text not null,
  description text not null,
  date text not null,
  status text default 'confirmed',
  payment_method text default 'credit',
  created_by_id text,
  created_by_name text,
  is_shared boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.shared_transactions enable row level security;

drop policy if exists "Acesso a transações compartilhadas" on public.shared_transactions;

create policy "Acesso a transações compartilhadas"
  on public.shared_transactions for all
  using (true)
  with check (true);

-- 5. Habilita o Realtime no Supabase para sincronização instantânea
-- (verifica antes para não dar erro se já estiver adicionado)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'card_invites'
  ) then
    alter publication supabase_realtime add table public.card_invites;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'shared_transactions'
  ) then
    alter publication supabase_realtime add table public.shared_transactions;
  end if;
end $$;
