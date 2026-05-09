create extension if not exists pgcrypto;

drop view if exists public.trending_photos;
drop view if exists public.photo_like_counts;
drop function if exists public.search_people(text);
drop function if exists public.search_events(text);
drop function if exists public.toggle_photo_like(uuid, text);
drop table if exists public.photo_likes cascade;
drop table if exists public.spotlights cascade;
drop table if exists public.photo_people cascade;
drop table if exists public.event_photos cascade;
drop table if exists public.event_aliases cascade;
drop table if exists public.people cascade;
drop table if exists public.participants cascade;
drop table if exists public.user_photos cascade;
drop table if exists public.processing_runs cascade;
drop table if exists public.events cascade;
drop table if exists public.photos cascade;

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  external_photo_id text not null unique,
  storage_path text,
  drive_file_id text,
  public_url text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  blurhash text,
  caption text,
  shot_at timestamptz,
  moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'hidden', 'rejected')),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  normalized_name text not null,
  description text,
  cover_photo_id uuid references public.photos(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  drive_folder_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_aliases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique (event_id, normalized_alias)
);

create table public.event_photos (
  event_id uuid not null references public.events(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, photo_id)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  normalized_name text not null,
  alias text,
  normalized_alias text,
  avatar_photo_id uuid references public.photos(id) on delete set null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create table public.photo_people (
  person_id uuid not null references public.people(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  bbox jsonb,
  source text not null default 'local_face_pipeline',
  review_status text not null default 'approved'
    check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (person_id, photo_id)
);

create table public.spotlights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  photo_id uuid not null references public.photos(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  href text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photo_likes (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  client_id_hash text not null,
  created_at timestamptz not null default now(),
  unique (photo_id, client_id_hash)
);

create unique index photos_drive_file_id_uidx on public.photos (drive_file_id)
  where drive_file_id is not null;
create index photos_public_idx on public.photos (is_published, moderation_status, shot_at desc);
create index events_public_idx on public.events (is_published, sort_order, normalized_name);
create index event_aliases_search_idx on public.event_aliases (normalized_alias);
create index event_photos_event_idx on public.event_photos (event_id, is_featured, sort_order);
create index event_photos_photo_idx on public.event_photos (photo_id);
create index people_search_idx on public.people (is_published, normalized_name, normalized_alias);
create index photo_people_person_idx on public.photo_people (person_id, review_status);
create index photo_people_photo_idx on public.photo_people (photo_id, review_status);
create index spotlights_active_idx on public.spotlights (is_active, sort_order);
create index spotlights_photo_idx on public.spotlights (photo_id);
create index spotlights_event_idx on public.spotlights (event_id);
create index events_cover_photo_idx on public.events (cover_photo_id);
create index people_avatar_photo_idx on public.people (avatar_photo_id);
create index photo_likes_photo_idx on public.photo_likes (photo_id, created_at desc);

create view public.photo_like_counts
with (security_invoker = true) as
select
  photo_id,
  count(*)::integer as like_count
from public.photo_likes
group by photo_id;

create view public.trending_photos
with (security_invoker = true) as
select
  p.id,
  p.external_photo_id,
  p.public_url,
  p.caption,
  p.shot_at,
  coalesce(plc.like_count, 0) as like_count,
  (
    coalesce(plc.like_count, 0) * 10
    + case when exists (
      select 1 from public.event_photos ep
      where ep.photo_id = p.id and ep.is_featured = true
    ) then 25 else 0 end
    + greatest(0, 14 - extract(day from now() - coalesce(p.shot_at, p.created_at)))::integer
  ) as trend_score
from public.photos p
left join public.photo_like_counts plc on plc.photo_id = p.id
where p.is_published = true
  and p.moderation_status = 'approved'
order by trend_score desc, coalesce(p.shot_at, p.created_at) desc;

create function public.search_people(query text)
returns table (
  id uuid,
  display_name text,
  alias text,
  avatar_photo_id uuid,
  match_count bigint
)
language sql
stable
as $$
  select
    pe.id,
    pe.display_name,
    pe.alias,
    pe.avatar_photo_id,
    count(pp.photo_id) filter (
      where ph.is_published = true and ph.moderation_status = 'approved'
    ) as match_count
  from public.people pe
  left join public.photo_people pp
    on pp.person_id = pe.id and pp.review_status = 'approved'
  left join public.photos ph on ph.id = pp.photo_id
  where pe.is_published = true
    and (
      pe.normalized_name ilike '%' || lower(trim(query)) || '%'
      or pe.normalized_alias ilike '%' || lower(trim(query)) || '%'
    )
  group by pe.id
  order by match_count desc, pe.display_name asc
  limit 12;
$$;

create function public.search_events(query text)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  cover_photo_id uuid,
  photo_count bigint
)
language sql
stable
as $$
  select
    ev.id,
    ev.slug,
    ev.name,
    ev.description,
    ev.cover_photo_id,
    count(ep.photo_id) filter (
      where ph.is_published = true and ph.moderation_status = 'approved'
    ) as photo_count
  from public.events ev
  left join public.event_aliases ea on ea.event_id = ev.id
  left join public.event_photos ep on ep.event_id = ev.id
  left join public.photos ph on ph.id = ep.photo_id
  where ev.is_published = true
    and (
      ev.normalized_name ilike '%' || lower(trim(query)) || '%'
      or ev.slug ilike '%' || lower(trim(query)) || '%'
      or ea.normalized_alias ilike '%' || lower(trim(query)) || '%'
    )
  group by ev.id
  order by photo_count desc, ev.sort_order asc, ev.name asc
  limit 12;
$$;

create function public.toggle_photo_like(target_photo_id uuid, target_client_id_hash text)
returns table (photo_id uuid, liked boolean, like_count integer)
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.photo_likes
    where photo_likes.photo_id = target_photo_id
      and photo_likes.client_id_hash = target_client_id_hash
  ) then
    delete from public.photo_likes
    where photo_likes.photo_id = target_photo_id
      and photo_likes.client_id_hash = target_client_id_hash;

    return query
    select target_photo_id, false, count(*)::integer
    from public.photo_likes
    where photo_likes.photo_id = target_photo_id;
  else
    insert into public.photo_likes (photo_id, client_id_hash)
    values (target_photo_id, target_client_id_hash)
    on conflict (photo_id, client_id_hash) do nothing;

    return query
    select target_photo_id, true, count(*)::integer
    from public.photo_likes
    where photo_likes.photo_id = target_photo_id;
  end if;
end;
$$;

alter table public.photos enable row level security;
alter table public.events enable row level security;
alter table public.event_aliases enable row level security;
alter table public.event_photos enable row level security;
alter table public.people enable row level security;
alter table public.photo_people enable row level security;
alter table public.spotlights enable row level security;
alter table public.photo_likes enable row level security;

create policy "Public can read published photos"
  on public.photos for select
  using (is_published = true and moderation_status = 'approved');

create policy "Public can read published events"
  on public.events for select
  using (is_published = true);

create policy "Public can read published event aliases"
  on public.event_aliases for select
  using (exists (
    select 1 from public.events ev
    where ev.id = event_aliases.event_id and ev.is_published = true
  ));

create policy "Public can read published event photo mappings"
  on public.event_photos for select
  using (
    exists (
      select 1 from public.events ev
      where ev.id = event_photos.event_id and ev.is_published = true
    )
    and exists (
      select 1 from public.photos ph
      where ph.id = event_photos.photo_id
        and ph.is_published = true
        and ph.moderation_status = 'approved'
    )
  );

create policy "Public can read published people"
  on public.people for select
  using (is_published = true);

create policy "Public can read approved person photo mappings"
  on public.photo_people for select
  using (
    review_status = 'approved'
    and exists (
      select 1 from public.people pe
      where pe.id = photo_people.person_id and pe.is_published = true
    )
    and exists (
      select 1 from public.photos ph
      where ph.id = photo_people.photo_id
        and ph.is_published = true
        and ph.moderation_status = 'approved'
    )
  );

create policy "Public can read active spotlights"
  on public.spotlights for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and exists (
      select 1 from public.photos ph
      where ph.id = spotlights.photo_id
        and ph.is_published = true
        and ph.moderation_status = 'approved'
    )
  );

create policy "Public can read likes"
  on public.photo_likes for select
  using (true);

grant usage on schema public to anon, authenticated;
grant select on public.photos, public.events, public.event_aliases, public.event_photos,
  public.people, public.photo_people, public.spotlights, public.photo_like_counts,
  public.trending_photos to anon, authenticated;
grant select (photo_id) on public.photo_likes to anon, authenticated;
grant execute on function public.search_people(text) to anon, authenticated;
grant execute on function public.search_events(text) to anon, authenticated;
revoke all on function public.toggle_photo_like(uuid, text) from public, anon, authenticated;
grant execute on function public.toggle_photo_like(uuid, text) to service_role;

comment on table public.people is
  'Public searchable person labels produced by the local matching/admin pipeline. These are not auth users.';

comment on table public.photo_people is
  'Public photo-person mappings from the local face pipeline. Embeddings stay local.';

comment on function public.toggle_photo_like(uuid, text) is
  'Anonymous likes are written through this RPC or the Mirage API, not direct table writes.';
