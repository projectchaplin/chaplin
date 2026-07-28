-- A creator wallet is separate from the royalty ledger: these credits buy
-- creation work, while ledger_entries records money earned by actors.

create table if not exists public.creator_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_granted integer not null default 0 check (lifetime_granted >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('welcome', 'spend', 'refund', 'adjustment')),
  idempotency_key text not null,
  description text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists creator_credit_transactions_user_created_idx
  on public.creator_credit_transactions(user_id, created_at desc);

alter table public.creator_credit_accounts enable row level security;
alter table public.creator_credit_transactions enable row level security;

drop policy if exists "Creators can read their credit account" on public.creator_credit_accounts;
create policy "Creators can read their credit account"
  on public.creator_credit_accounts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Creators can read their credit history" on public.creator_credit_transactions;
create policy "Creators can read their credit history"
  on public.creator_credit_transactions for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.ensure_creator_welcome_credits(requested_user_id uuid)
returns table (balance integer, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.creator_credit_accounts (
    user_id, balance, lifetime_granted
  ) values (
    requested_user_id, 100, 100
  )
  on conflict (user_id) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    insert into public.creator_credit_transactions (
      user_id, amount, kind, idempotency_key, description, metadata
    ) values (
      requested_user_id,
      100,
      'welcome',
      'welcome:100',
      '100 welcome credits on the house',
      jsonb_build_object('grant', 'creator_welcome')
    );
  end if;

  return query
    select account.balance, inserted_count = 1
    from public.creator_credit_accounts account
    where account.user_id = requested_user_id;
end;
$$;

create or replace function public.spend_creator_credits(
  requested_user_id uuid,
  requested_amount integer,
  requested_key text,
  requested_description text,
  requested_metadata jsonb default '{}'
)
returns table (balance integer, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if requested_amount <= 0 then
    raise exception 'Credit amount must be positive.';
  end if;

  perform public.ensure_creator_welcome_credits(requested_user_id);

  select account.balance into current_balance
  from public.creator_credit_accounts account
  where account.user_id = requested_user_id
  for update;

  if exists (
    select 1 from public.creator_credit_transactions tx
    where tx.user_id = requested_user_id
      and tx.idempotency_key = requested_key
  ) then
    return query select current_balance, false;
    return;
  end if;

  if current_balance < requested_amount then
    raise exception 'Not enough Chaplin credits. You have % credits and need %.', current_balance, requested_amount;
  end if;

  update public.creator_credit_accounts
  set
    balance = creator_credit_accounts.balance - requested_amount,
    lifetime_spent = creator_credit_accounts.lifetime_spent + requested_amount,
    updated_at = now()
  where user_id = requested_user_id
  returning creator_credit_accounts.balance into current_balance;

  insert into public.creator_credit_transactions (
    user_id, amount, kind, idempotency_key, description, metadata
  ) values (
    requested_user_id,
    -requested_amount,
    'spend',
    requested_key,
    requested_description,
    requested_metadata
  );

  return query select current_balance, true;
end;
$$;

create or replace function public.refund_creator_credits(
  requested_user_id uuid,
  requested_key text,
  requested_description text
)
returns table (balance integer, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  spend_amount integer;
  current_balance integer;
  refund_key text := 'refund:' || requested_key;
begin
  select -tx.amount into spend_amount
  from public.creator_credit_transactions tx
  where tx.user_id = requested_user_id
    and tx.idempotency_key = requested_key
    and tx.kind = 'spend';

  select account.balance into current_balance
  from public.creator_credit_accounts account
  where account.user_id = requested_user_id
  for update;

  if spend_amount is null or exists (
    select 1 from public.creator_credit_transactions tx
    where tx.user_id = requested_user_id
      and tx.idempotency_key = refund_key
  ) then
    return query select coalesce(current_balance, 0), false;
    return;
  end if;

  update public.creator_credit_accounts
  set
    balance = creator_credit_accounts.balance + spend_amount,
    lifetime_spent = greatest(0, creator_credit_accounts.lifetime_spent - spend_amount),
    updated_at = now()
  where user_id = requested_user_id
  returning creator_credit_accounts.balance into current_balance;

  insert into public.creator_credit_transactions (
    user_id, amount, kind, idempotency_key, description, metadata
  ) values (
    requested_user_id,
    spend_amount,
    'refund',
    refund_key,
    requested_description,
    jsonb_build_object('originalKey', requested_key)
  );

  return query select current_balance, true;
end;
$$;

revoke all on function public.ensure_creator_welcome_credits(uuid) from public, anon, authenticated;
revoke all on function public.spend_creator_credits(uuid, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.refund_creator_credits(uuid, text, text) from public, anon, authenticated;
