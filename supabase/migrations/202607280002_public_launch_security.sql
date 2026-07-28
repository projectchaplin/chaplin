-- Persistent, atomic throttling for public authentication and provider-backed
-- generation. Keys are one-way fingerprints assembled by the server; raw IP
-- addresses and submitted email addresses are never stored.

create table if not exists public.creator_signup_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null default 'chaplin-signup',
  created_at timestamptz not null default now()
);

alter table public.creator_signup_entitlements enable row level security;
revoke all on table public.creator_signup_entitlements from public, anon, authenticated;

-- Every profile that existed before this boundary was created through Chaplin's
-- authenticated profile path and has already qualified for the welcome grant.
insert into public.creator_signup_entitlements (user_id, source)
select profile.user_id, 'pre-security-profile'
from public.user_profiles profile
where profile.account_role = 'creator'
on conflict (user_id) do nothing;

create or replace function public.ensure_creator_welcome_credits(requested_user_id uuid)
returns table (balance integer, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if not exists (
    select 1
    from public.creator_signup_entitlements entitlement
    where entitlement.user_id = requested_user_id
  ) then
    return query
      select coalesce(account.balance, 0), false
      from (select 1) placeholder
      left join public.creator_credit_accounts account
        on account.user_id = requested_user_id;
    return;
  end if;

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
    return query select coalesce(current_balance, 0), false;
    return;
  end if;

  if current_balance is null or current_balance < requested_amount then
    raise exception 'Not enough Chaplin credits. You have % credits and need %.',
      coalesce(current_balance, 0), requested_amount;
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

revoke all on function public.ensure_creator_welcome_credits(uuid)
  from public, anon, authenticated;
revoke all on function public.spend_creator_credits(uuid, integer, text, text, jsonb)
  from public, anon, authenticated;

create table if not exists public.api_rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limit_buckets enable row level security;
create index if not exists api_rate_limit_buckets_updated_idx
  on public.api_rate_limit_buckets(updated_at);

create or replace function public.consume_api_rate_limit(
  requested_key text,
  requested_limit integer,
  requested_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  current_window timestamptz;
begin
  if length(requested_key) < 8 or length(requested_key) > 300 then
    raise exception 'Rate-limit key is invalid.';
  end if;
  if requested_limit < 1 or requested_limit > 10000 then
    raise exception 'Rate-limit request limit is invalid.';
  end if;
  if requested_window_seconds < 1 or requested_window_seconds > 604800 then
    raise exception 'Rate-limit window is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requested_key, 0));

  if random() < 0.01 then
    delete from public.api_rate_limit_buckets
    where updated_at < now() - interval '8 days';
  end if;

  insert into public.api_rate_limit_buckets (
    bucket_key, window_started_at, request_count, updated_at
  ) values (
    requested_key, now(), 1, now()
  )
  on conflict (bucket_key) do update
  set
    window_started_at = case
      when api_rate_limit_buckets.window_started_at
        <= now() - make_interval(secs => requested_window_seconds)
      then now()
      else api_rate_limit_buckets.window_started_at
    end,
    request_count = case
      when api_rate_limit_buckets.window_started_at
        <= now() - make_interval(secs => requested_window_seconds)
      then 1
      else api_rate_limit_buckets.request_count + 1
    end,
    updated_at = now()
  returning request_count, window_started_at
  into current_count, current_window;

  return query select
    current_count <= requested_limit,
    greatest(0, requested_limit - current_count),
    current_window + make_interval(secs => requested_window_seconds);
end;
$$;

revoke all on table public.api_rate_limit_buckets from public, anon, authenticated;
revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
