-- 0005_metrics_v2.sql
-- Fase 2 das métricas: alcance (swipes) e sessões únicas por prato,
-- além de estatísticas por mesa (sessões e chamadas).
-- Não sobrescreve as funções v1: o app usa v2 quando existir e cai para v1 caso contrário.

-- ─── Inteligência por prato v2 ─────────────────────────────────────────────
-- views            = quantas product_view (prato entrou em foco)
-- avg_attention_s  = tempo médio de atenção (s)
-- favorites        = favoritos
-- customize_opens  = aberturas de personalização
-- swipes           = eventos de swipe até o prato (alcance/exposição)
-- unique_sessions  = sessões distintas que viram o prato (funil)
create or replace function public.product_intelligence_v2(_tenant uuid, _days int)
returns table(
  product_id uuid,
  views bigint,
  avg_attention_s numeric,
  favorites bigint,
  customize_opens bigint,
  swipes bigint,
  unique_sessions bigint
)
language sql stable security invoker set search_path = public as $$
  select
    e.product_id,
    count(*) filter (where e.event_type = 'product_view') as views,
    round(avg(e.duration_ms) filter (where e.event_type = 'product_view') / 1000.0, 1) as avg_attention_s,
    count(*) filter (where e.event_type = 'favorite') as favorites,
    count(*) filter (where e.event_type = 'customize_open') as customize_opens,
    count(*) filter (where e.event_type = 'swipe') as swipes,
    count(distinct e.session_id) filter (where e.event_type = 'product_view') as unique_sessions
  from public.telemetry_events e
  where e.tenant_id = _tenant
    and e.product_id is not null
    and e.created_at > now() - make_interval(days => _days)
  group by e.product_id
$$;

grant execute on function public.product_intelligence_v2(uuid, int) to authenticated;

-- ─── Estatísticas por mesa ─────────────────────────────────────────────────
-- sessions = sessões distintas iniciadas com aquela mesa (telemetria)
-- calls    = chamadas de garçom/conta/gerente feitas por aquela mesa
create or replace function public.table_stats(_tenant uuid, _days int)
returns table(
  table_ref text,
  sessions bigint,
  calls bigint
)
language sql stable security invoker set search_path = public as $$
  with sess as (
    select coalesce(nullif(e.table_ref, ''), '(sem mesa)') as table_ref,
           count(distinct e.session_id) as sessions
    from public.telemetry_events e
    where e.tenant_id = _tenant
      and e.event_type = 'session_start'
      and e.created_at > now() - make_interval(days => _days)
    group by 1
  ),
  calls as (
    select coalesce(nullif(w.table_ref, ''), '(sem mesa)') as table_ref,
           count(*) as calls
    from public.waiter_calls w
    where w.tenant_id = _tenant
      and w.created_at > now() - make_interval(days => _days)
    group by 1
  )
  select coalesce(s.table_ref, c.table_ref) as table_ref,
         coalesce(s.sessions, 0) as sessions,
         coalesce(c.calls, 0) as calls
  from sess s
  full outer join calls c on s.table_ref = c.table_ref
  order by sessions desc nulls last, calls desc nulls last
$$;

grant execute on function public.table_stats(uuid, int) to authenticated;
