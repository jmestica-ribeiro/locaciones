-- Esquema inicial de locaciones-app.
-- Réplica de la estructura del proyecto Supabase de pd-obras-app ("Partes Diarios",
-- cdmuackrcphnpguronva) al 2026-10-23, sin datos. Se omite el schema `aluvional`,
-- que pertenece a otra app alojada en ese mismo proyecto.
--
-- No incluye secretos: el secreto de vault `notif_webhook_secret` y los secretos de
-- la Edge Function (WEBHOOK_SECRET, RESEND_API_KEY) se cargan aparte.

begin;

create extension if not exists pg_net with schema extensions;

-- ── Tablas ─────────────────────────────────────────────────────────────────

create table public."Proyectos" (
  "ID_Proyecto"   text not null,
  "Cliente"       text not null,
  "Ubicación"     text,
  "Descripción"   text,
  "Estado"        text,
  "Tipo_Proyecto" text,
  "CECO"          text,
  constraint "Proyectos_pkey" primary key ("ID_Proyecto")
);

create table public."Etapas" (
  "ID"          uuid not null default gen_random_uuid(),
  "ID_Proyecto" text not null,
  created_at    timestamptz not null default now(),
  nombre_etapa  text,
  fase          text,
  "UM"          text,
  total         numeric,
  incidencia    numeric,
  constraint "Etapas_pkey" primary key ("ID"),
  constraint "Etapas_ID_Proyecto_fkey" foreign key ("ID_Proyecto")
    references public."Proyectos"("ID_Proyecto") on update cascade on delete cascade
);

create table public."Avance" (
  id                  uuid not null default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  "ID_Proyecto"       text,
  fecha_avance        date,
  total_avance        numeric,
  "UM"                text,
  descripcion         text,
  estado_revision     text default '"SIN REVISAR"'::text,
  motivo_npt          text,
  tiempo_npt          bigint,
  detalle_npt         text,
  nombre_etapa        text,
  fase                text,
  "ID_Parte"          uuid,
  observaciones_parte text,
  constraint "Avance_pkey" primary key (id)
);

create table public."Recursos" (
  id                 uuid not null default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  "ID_Avance"        uuid,
  "ID_Etapa"         text,
  total_hs           numeric,
  tipo_recurso       text,
  categoria          text,
  detalle_recurso    text,
  observaciones      text,
  "ID_RecursoFuente" uuid,
  puesto             text,
  familia            text,
  subfamilia         text,
  constraint "Recursos_pkey" primary key (id),
  constraint "Recursos_ID_Avance_fkey" foreign key ("ID_Avance")
    references public."Avance"(id) on update cascade
);

create table public."InsumosPlanificados" (
  id             uuid not null default gen_random_uuid(),
  "ID_Etapa"     text not null,
  nombre         text not null,
  unidad         text,
  cantidad       numeric,
  costo_unitario numeric,
  observaciones  text,
  created_at     timestamptz default now(),
  constraint "InsumosPlanificados_pkey" primary key (id)
);

create table public."ListadoPersonal" (
  id           uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  nombre       text,
  apellido     text,
  puesto       text,
  legajo       text,
  centro_costo text,
  constraint "ListadoPersonal_pkey" primary key (id)
);

create table public."ListadoVehiculos" (
  id         uuid not null default gen_random_uuid(),
  created_at timestamptz default now(),
  interno    text,
  dominio    text,
  familia    text,
  subfamilia text,
  constraint "ListadoVehiculos_pkey" primary key (id)
);

create table public."Fases" (
  id         uuid not null default gen_random_uuid(),
  created_at timestamptz default now(),
  nombre     text not null,
  constraint "Fases_pkey" primary key (id),
  constraint "Fases_nombre_key" unique (nombre)
);

create table public."CurvasPlan" (
  id            uuid not null default gen_random_uuid(),
  created_at    timestamptz default now(),
  "ID_Proyecto" text not null,
  nombre        text not null,
  modo          text not null default 'porcentaje'::text,
  constraint "CurvasPlan_pkey" primary key (id),
  constraint "CurvasPlan_modo_check" check (modo = any (array['porcentaje'::text, 'item'::text])),
  constraint "CurvasPlan_ID_Proyecto_fkey" foreign key ("ID_Proyecto")
    references public."Proyectos"("ID_Proyecto") on delete cascade
);

create table public."PuntosCurva" (
  id         uuid not null default gen_random_uuid(),
  created_at timestamptz default now(),
  "ID_Curva" uuid not null,
  fecha      date not null,
  avance     numeric not null,
  constraint "PuntosCurva_pkey" primary key (id),
  constraint "PuntosCurva_avance_check" check (avance >= 0::numeric and avance <= 100::numeric),
  constraint "PuntosCurva_ID_Curva_fkey" foreign key ("ID_Curva")
    references public."CurvasPlan"(id) on delete cascade
);

create table public."PuntosCurvaItem" (
  id         uuid not null default gen_random_uuid(),
  "ID_Curva" uuid not null,
  "ID_Etapa" uuid not null,
  fecha      date not null,
  cantidad   numeric not null,
  created_at timestamptz default now(),
  constraint "PuntosCurvaItem_pkey" primary key (id),
  constraint "PuntosCurvaItem_ID_Curva_ID_Etapa_fecha_key" unique ("ID_Curva", "ID_Etapa", fecha),
  constraint "PuntosCurvaItem_cantidad_check" check (cantidad >= 0::numeric),
  constraint "PuntosCurvaItem_ID_Curva_fkey" foreign key ("ID_Curva")
    references public."CurvasPlan"(id) on delete cascade,
  constraint "PuntosCurvaItem_ID_Etapa_fkey" foreign key ("ID_Etapa")
    references public."Etapas"("ID") on delete cascade
);

create table public."FotosPartes" (
  id            uuid not null default gen_random_uuid(),
  created_at    timestamptz default now(),
  "ID_Parte"    uuid,
  "ID_Proyecto" text,
  url           text not null,
  nombre        text,
  orden         smallint default 0,
  constraint "FotosPartes_pkey" primary key (id),
  constraint "FotosPartes_ID_Proyecto_fkey" foreign key ("ID_Proyecto")
    references public."Proyectos"("ID_Proyecto") on delete cascade
);

-- aluvional / partes_diarios son flags de acceso que comparte el proyecto original
-- con otras apps; se mantienen porque prevent_self_role_escalation() los referencia.
create table public.profiles (
  id             uuid not null,
  nombre         text,
  rol            text not null default 'operador'::text,
  created_at     timestamptz default now(),
  aluvional      boolean default false,
  partes_diarios boolean default false,
  constraint profiles_pkey primary key (id),
  constraint profiles_rol_check check (rol = any (array['admin'::text, 'operador'::text])),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade
);

create table public."MotivosNPT" (
  id            uuid not null default gen_random_uuid(),
  nombre        text not null,
  clasificacion text not null,
  created_at    timestamptz not null default now(),
  constraint "MotivosNPT_pkey" primary key (id),
  constraint "MotivosNPT_nombre_key" unique (nombre),
  constraint "MotivosNPT_clasificacion_check" check (clasificacion = any (array['gestionable'::text, 'no_gestionable'::text]))
);

create table public."Notificaciones" (
  id              uuid not null default gen_random_uuid(),
  destinatario_id uuid not null,
  tipo            text not null,
  "ID_Proyecto"   text,
  "ID_Parte"      uuid,
  titulo          text not null,
  mensaje         text not null,
  leida           boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint "Notificaciones_pkey" primary key (id),
  constraint "Notificaciones_tipo_check" check (tipo = any (array['parte_cargado'::text, 'npt'::text])),
  constraint "Notificaciones_destinatario_id_fkey" foreign key (destinatario_id)
    references auth.users(id) on delete cascade
);

create table public."NotificacionesConfig" (
  id              uuid not null default gen_random_uuid(),
  tipo            text not null,
  destinatario_id uuid not null,
  created_at      timestamptz not null default now(),
  constraint "NotificacionesConfig_pkey" primary key (id),
  constraint "NotificacionesConfig_tipo_destinatario_id_key" unique (tipo, destinatario_id),
  constraint "NotificacionesConfig_tipo_check" check (tipo = any (array['parte_cargado'::text, 'npt'::text])),
  constraint "NotificacionesConfig_destinatario_id_fkey" foreign key (destinatario_id)
    references auth.users(id) on delete cascade
);

-- ── Índices ────────────────────────────────────────────────────────────────

create index idx_avance_id_parte on public."Avance" using btree ("ID_Parte");
create index idx_notificaciones_destinatario on public."Notificaciones" using btree (destinatario_id, leida, created_at desc);
create index "PuntosCurvaItem_ID_Curva_idx" on public."PuntosCurvaItem" using btree ("ID_Curva");
create index "PuntosCurvaItem_ID_Etapa_idx" on public."PuntosCurvaItem" using btree ("ID_Etapa");

-- ── Permisos de tablas (iguales al proyecto original) ──────────────────────

grant select, insert, update, delete, truncate, references, trigger on table
  public."Avance", public."CurvasPlan", public."Etapas", public."Fases", public."FotosPartes",
  public."InsumosPlanificados", public."ListadoPersonal", public."ListadoVehiculos",
  public."MotivosNPT", public."Notificaciones", public."NotificacionesConfig", public."Proyectos",
  public."PuntosCurva", public."PuntosCurvaItem", public."Recursos", public.profiles
to anon, authenticated, service_role;

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public."Avance"               enable row level security;
alter table public."CurvasPlan"           enable row level security;
alter table public."Etapas"               enable row level security;
alter table public."Fases"                enable row level security;
alter table public."FotosPartes"          enable row level security;
alter table public."InsumosPlanificados"  enable row level security;
alter table public."ListadoPersonal"      enable row level security;
alter table public."ListadoVehiculos"     enable row level security;
alter table public."MotivosNPT"           enable row level security;
alter table public."Notificaciones"       enable row level security;
alter table public."NotificacionesConfig" enable row level security;
alter table public."Proyectos"            enable row level security;
alter table public."PuntosCurva"          enable row level security;
alter table public."PuntosCurvaItem"      enable row level security;
alter table public."Recursos"             enable row level security;
alter table public.profiles               enable row level security;

create policy authenticated_all_avance        on public."Avance"              for all to authenticated using (true) with check (true);
create policy authenticated_all_curvasplan    on public."CurvasPlan"          for all to authenticated using (true) with check (true);
create policy authenticated_all_etapas        on public."Etapas"              for all to authenticated using (true) with check (true);
create policy authenticated_all_fases         on public."Fases"               for all to authenticated using (true) with check (true);
create policy "Allow all authenticated"       on public."FotosPartes"         for all to authenticated using (true) with check (true);
create policy authenticated_all_insumos       on public."InsumosPlanificados" for all to authenticated using (true) with check (true);
create policy authenticated_all_personal      on public."ListadoPersonal"     for all to authenticated using (true) with check (true);
create policy authenticated_all_vehiculos     on public."ListadoVehiculos"    for all to authenticated using (true) with check (true);
create policy authenticated_all_proyectos     on public."Proyectos"           for all to authenticated using (true) with check (true);
create policy authenticated_all_puntoscurva   on public."PuntosCurva"         for all to authenticated using (true) with check (true);
create policy authenticated_all_puntoscurvaitem on public."PuntosCurvaItem"   for all to authenticated using (true) with check (true);
create policy authenticated_all_recursos      on public."Recursos"            for all to authenticated using (true) with check (true);

create policy select_motivos_npt on public."MotivosNPT" for select to authenticated using (true);
create policy admins_insert_motivos_npt on public."MotivosNPT" for insert to public
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.rol = 'admin'::text));
create policy admins_update_motivos_npt on public."MotivosNPT" for update to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.rol = 'admin'::text))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.rol = 'admin'::text));
create policy admins_delete_motivos_npt on public."MotivosNPT" for delete to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.rol = 'admin'::text));

create policy select_own_notificaciones on public."Notificaciones" for select to public
  using (auth.uid() = destinatario_id);
create policy update_own_notificaciones on public."Notificaciones" for update to public
  using (auth.uid() = destinatario_id) with check (auth.uid() = destinatario_id);

create policy admins_manage_notif_config on public."NotificacionesConfig" for all to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.rol = 'admin'::text))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.rol = 'admin'::text));

create policy "Authenticated can read all profiles" on public.profiles for select to authenticated using (true);
create policy "User can update own profile" on public.profiles for update to public using (auth.uid() = id);
create policy "Admin can update any profile" on public.profiles for update to public
  using (exists (select 1 from profiles profiles_1 where profiles_1.id = auth.uid() and profiles_1.rol = 'admin'::text));

-- ── Funciones ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'operador')
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (NEW.rol is distinct from OLD.rol)
     or (NEW.aluvional is distinct from OLD.aluvional)
     or (NEW.partes_diarios is distinct from OLD.partes_diarios) then
    if not exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin') then
      raise exception 'Solo un administrador puede cambiar el rol o los accesos de un usuario';
    end if;
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_usuarios_notificables()
 RETURNS TABLE(id uuid, nombre text, rol text, email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.nombre, p.rol, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.rol = 'admin')
  order by p.nombre;
$function$;

-- Igual que en el original, salvo la URL de la Edge Function, que apunta a este proyecto.
CREATE OR REPLACE FUNCTION public.fn_notificar_parte()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_es_primero boolean;
  v_hay_npt boolean;
  v_destinatarios jsonb;
  v_webhook_secret text;
  v_payload jsonb;
begin
  select not exists (
    select 1 from "Avance" where "ID_Parte" = NEW."ID_Parte" and id <> NEW.id
  ) into v_es_primero;

  v_hay_npt := NEW.tiempo_npt is not null and NEW.tiempo_npt > 0;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets where name = 'notif_webhook_secret';

  if v_es_primero then
    insert into "Notificaciones" (destinatario_id, tipo, "ID_Proyecto", "ID_Parte", titulo, mensaje)
    select destinatario_id, 'parte_cargado', NEW."ID_Proyecto", NEW."ID_Parte",
      'Nuevo parte cargado',
      format('Se cargó un parte del %s en el proyecto %s', to_char(NEW.fecha_avance, 'DD/MM/YYYY'), NEW."ID_Proyecto")
    from "NotificacionesConfig" where tipo = 'parte_cargado';

    select jsonb_agg(jsonb_build_object('email', u.email, 'nombre', coalesce(p.nombre, 'Administrador')))
    into v_destinatarios
    from "NotificacionesConfig" c
    join profiles p on p.id = c.destinatario_id
    join auth.users u on u.id = p.id
    where c.tipo = 'parte_cargado';

    if v_destinatarios is not null and v_webhook_secret is not null then
      v_payload := jsonb_build_object(
        'proyecto', NEW."ID_Proyecto", 'parte_id', NEW."ID_Parte", 'fecha', NEW.fecha_avance,
        'etapa', NEW.nombre_etapa, 'npt_horas', null, 'npt_motivo', null,
        'es_primero', true, 'hay_npt', false, 'destinatarios', v_destinatarios
      );
      perform net.http_post(
        url := 'https://glhnhfvdkhfgnrnbwlac.supabase.co/functions/v1/send-notification-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
        body := v_payload
      );
    end if;
  end if;

  if v_hay_npt then
    insert into "Notificaciones" (destinatario_id, tipo, "ID_Proyecto", "ID_Parte", titulo, mensaje)
    select destinatario_id, 'npt', NEW."ID_Proyecto", NEW."ID_Parte",
      'Tiempo no productivo registrado',
      case
        when nullif(NEW.nombre_etapa, '') is null then
          format('%s hs de NPT sin ítem (%s) — %s', NEW.tiempo_npt, NEW."ID_Proyecto", coalesce(NEW.motivo_npt, 'sin motivo especificado'))
        else
          format('%s hs de NPT en "%s" (%s) — %s', NEW.tiempo_npt, NEW.nombre_etapa, NEW."ID_Proyecto", coalesce(NEW.motivo_npt, 'sin motivo especificado'))
      end
    from "NotificacionesConfig" where tipo = 'npt';

    select jsonb_agg(jsonb_build_object('email', u.email, 'nombre', coalesce(p.nombre, 'Administrador')))
    into v_destinatarios
    from "NotificacionesConfig" c
    join profiles p on p.id = c.destinatario_id
    join auth.users u on u.id = p.id
    where c.tipo = 'npt';

    if v_destinatarios is not null and v_webhook_secret is not null then
      v_payload := jsonb_build_object(
        'proyecto', NEW."ID_Proyecto", 'parte_id', NEW."ID_Parte", 'fecha', NEW.fecha_avance,
        'etapa', coalesce(nullif(NEW.nombre_etapa, ''), 'Sin ítem'), 'npt_horas', NEW.tiempo_npt, 'npt_motivo', NEW.motivo_npt,
        'es_primero', false, 'hay_npt', true, 'destinatarios', v_destinatarios
      );
      perform net.http_post(
        url := 'https://glhnhfvdkhfgnrnbwlac.supabase.co/functions/v1/send-notification-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
        body := v_payload
      );
    end if;
  end if;

  return NEW;
end;
$function$;

-- Solo get_usuarios_notificables() es invocable desde la app; las de trigger quedan
-- restringidas a postgres/service_role, como en el original.
revoke all on function public.handle_new_user()              from public, anon, authenticated;
revoke all on function public.prevent_self_role_escalation() from public, anon, authenticated;
revoke all on function public.fn_notificar_parte()           from public, anon, authenticated;
revoke all on function public.get_usuarios_notificables()    from public, anon;
grant execute on function public.handle_new_user()              to service_role;
grant execute on function public.prevent_self_role_escalation() to service_role;
grant execute on function public.fn_notificar_parte()           to service_role;
grant execute on function public.get_usuarios_notificables()    to authenticated, service_role;

-- ── Triggers ───────────────────────────────────────────────────────────────

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trg_notificar_parte after insert on public."Avance"
  for each row execute function public.fn_notificar_parte();

create trigger trg_prevent_self_role_escalation before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- ── Storage ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public) values ('partes-fotos', 'partes-fotos', false);

create policy "Allow authenticated read partes-fotos" on storage.objects for select to authenticated
  using (bucket_id = 'partes-fotos'::text);
create policy "Allow authenticated uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'partes-fotos'::text);
create policy "Allow authenticated delete" on storage.objects for delete to authenticated
  using (bucket_id = 'partes-fotos'::text);

-- ── Realtime ───────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public."Notificaciones";

commit;
