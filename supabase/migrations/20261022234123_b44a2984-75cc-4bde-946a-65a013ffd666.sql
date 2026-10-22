alter type workshop.advance_status add value if not exists 'paid';
alter type workshop.advance_status add value if not exists 'partially_settled';
alter type workshop.advance_status add value if not exists 'settled';
alter type workshop.advance_status add value if not exists 'reversed';

alter table workshop.advances
  add column if not exists created_by uuid,
  add column if not exists entry_mode text not null default 'self',
  add column if not exists payment_method text,
  add column if not exists paid_amount numeric,
  add column if not exists paid_at date,
  add column if not exists paid_by uuid,
  add column if not exists payment_reference text,
  add column if not exists s103_approval_ref text,
  add column if not exists is_legacy boolean not null default false,
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciled_by uuid,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid,
  add column if not exists reverse_reason text;

update workshop.advances set is_legacy = true where status::text = 'approved';

alter table workshop.salaries
  add column if not exists other_s114_deductions numeric not null default 0,
  add column if not exists advance_deduction_total numeric not null default 0;
alter table workshop.salaries add constraint salaries_person_period_uniq unique (workspace_id, profile_id, period);

create table workshop.advance_deductions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  advance_id uuid not null references workshop.advances(id),
  salary_id uuid not null references workshop.salaries(id),
  period text not null,
  amount numeric not null check (amount > 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (advance_id, salary_id)
);
grant select on workshop.advance_deductions to authenticated;
grant all on workshop.advance_deductions to service_role;
alter table workshop.advance_deductions enable row level security;
create policy adv_ded_select on workshop.advance_deductions for select to authenticated
  using (workspace_id = core.current_workspace_id() and (core.is_owner_or_manager()
    or exists (select 1 from workshop.advances a where a.id = advance_id and a.profile_id = auth.uid())));

create table workshop.deduction_policy (
  workspace_id uuid primary key,
  cap_percent numeric not null default 50,
  law_version text not null default 'Labour Ordinance (Sarawak) Cap. 76 — amended, effective 1 May 2025',
  effective_date date default '2025-05-01',
  exceptions jsonb not null default '[]'::jsonb,
  source_links jsonb not null default '[]'::jsonb,
  last_review_date date,
  reviewer_name text,
  note_zh text, note_en text, note_ms text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select on workshop.deduction_policy to authenticated;
grant all on workshop.deduction_policy to service_role;
alter table workshop.deduction_policy enable row level security;
create policy ded_policy_select on workshop.deduction_policy for select to authenticated
  using (workspace_id = core.current_workspace_id());

create table workshop.advance_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  advance_id uuid,
  salary_id uuid,
  event text not null,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);
grant select on workshop.advance_events to authenticated;
grant all on workshop.advance_events to service_role;
alter table workshop.advance_events enable row level security;
create policy adv_events_select on workshop.advance_events for select to authenticated
  using (workspace_id = core.current_workspace_id() and core.is_owner_or_manager());

-- helpers
create or replace function workshop.advance_balance(p_advance uuid, p_exclude_salary uuid default null)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(a.paid_amount, 0) - coalesce((select sum(d.amount) from workshop.advance_deductions d
    where d.advance_id = a.id and (p_exclude_salary is null or d.salary_id <> p_exclude_salary)), 0)
  from workshop.advances a where a.id = p_advance;
$$;

create or replace function workshop.log_advance_event(p_ws uuid, p_adv uuid, p_sal uuid, p_event text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into workshop.advance_events(workspace_id, advance_id, salary_id, event, details, actor_id)
  values (p_ws, p_adv, p_sal, p_event, coalesce(p_details,'{}'::jsonb), auth.uid());
$$;
revoke execute on function workshop.log_advance_event(uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;

create or replace function workshop.one_month_wage(p_ws uuid, p_profile uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select s.basic + s.allowances + s.bonus from workshop.salaries s
  where s.workspace_id = p_ws and s.profile_id = p_profile order by s.period desc limit 1;
$$;

create or replace function workshop.create_advance_on_behalf(
  p_profile uuid, p_amount numeric, p_reason text, p_method text, p_paid_at date,
  p_reference text default null, p_s103_ref text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ws uuid := core.current_workspace_id(); v_id uuid; v_wage numeric;
begin
  if v_ws is null or not core.is_owner_or_manager() then raise exception '无权限 / Not allowed'; end if;
  if p_amount is null or p_amount <= 0 then raise exception '金额无效 / Invalid amount'; end if;
  if not exists (select 1 from core.profiles where id = p_profile and workspace_id = v_ws) then
    raise exception '找不到此工友 / Team Member not found'; end if;
  if p_paid_at is not null and coalesce(p_method,'') not in ('cash','bank','duitnow') then
    raise exception '请选择付款方式 / Choose payment method'; end if;
  v_wage := workshop.one_month_wage(v_ws, p_profile);
  if p_paid_at is not null and (v_wage is null or p_amount > v_wage) and coalesce(p_s103_ref,'') = '' then
    raise exception '预支超过一个月工资（或没有工资资料），依第103条需要批准编号 / Advance exceeds one month''s wages (s.103): approval reference required';
  end if;
  insert into workshop.advances(workspace_id, profile_id, amount, reason, status, created_by, entry_mode,
    reviewed_at, reviewed_by, payment_method, paid_amount, paid_at, paid_by, payment_reference, s103_approval_ref)
  values (v_ws, p_profile, round(p_amount,2), nullif(p_reason,''),
    (case when p_paid_at is null then 'approved' else 'paid' end)::workshop.advance_status,
    auth.uid(), 'on_behalf', now(), auth.uid(),
    case when p_paid_at is null then null else p_method end,
    case when p_paid_at is null then null else round(p_amount,2) end,
    p_paid_at, case when p_paid_at is null then null else auth.uid() end, nullif(p_reference,''), nullif(p_s103_ref,''))
  returning id into v_id;
  perform workshop.log_advance_event(v_ws, v_id, null, 'created_on_behalf',
    jsonb_build_object('amount', p_amount, 'paid_at', p_paid_at, 'method', p_method));
  return v_id;
end $$;

create or replace function workshop.record_advance_payment(
  p_id uuid, p_method text, p_paid_at date, p_reference text default null, p_s103_ref text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ws uuid := core.current_workspace_id(); a workshop.advances; v_wage numeric;
begin
  if v_ws is null or not core.is_owner_or_manager() then raise exception '无权限 / Not allowed'; end if;
  select * into a from workshop.advances where id = p_id and workspace_id = v_ws for update;
  if not found then raise exception 'Not found'; end if;
  if a.status::text <> 'approved' then raise exception '只能为已批准的预支记录付款 / Only approved advances can be marked paid'; end if;
  if coalesce(p_method,'') not in ('cash','bank','duitnow') or p_paid_at is null then
    raise exception '请填付款方式和日期 / Method and paid date required'; end if;
  v_wage := workshop.one_month_wage(v_ws, a.profile_id);
  if (v_wage is null or a.amount > v_wage) and coalesce(p_s103_ref, a.s103_approval_ref, '') = '' then
    raise exception '预支超过一个月工资（或没有工资资料），依第103条需要批准编号 / s.103 approval reference required';
  end if;
  update workshop.advances set status = 'paid', payment_method = p_method, paid_at = p_paid_at,
    paid_amount = a.amount, paid_by = auth.uid(), payment_reference = nullif(p_reference,''),
    s103_approval_ref = coalesce(nullif(p_s103_ref,''), a.s103_approval_ref),
    is_legacy = false, reconciled_at = case when a.is_legacy then now() end,
    reconciled_by = case when a.is_legacy then auth.uid() end
  where id = p_id;
  perform workshop.log_advance_event(v_ws, p_id, null, 'paid',
    jsonb_build_object('method', p_method, 'paid_at', p_paid_at, 'legacy_reconciled', a.is_legacy));
end $$;

create or replace function workshop.reverse_advance(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ws uuid := core.current_workspace_id(); a workshop.advances;
begin
  if v_ws is null or not core.is_owner_or_manager() then raise exception '无权限 / Not allowed'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception '需要原因 / Reason required'; end if;
  select * into a from workshop.advances where id = p_id and workspace_id = v_ws for update;
  if not found then raise exception 'Not found'; end if;
  if exists (select 1 from workshop.advance_deductions where advance_id = p_id) then
    raise exception '已有扣除记录，不能撤销 / Has deductions, cannot reverse'; end if;
  if a.status::text not in ('approved','paid') then raise exception 'Cannot reverse this status'; end if;
  update workshop.advances set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reverse_reason = p_reason where id = p_id;
  perform workshop.log_advance_event(v_ws, p_id, null, 'reversed', jsonb_build_object('reason', p_reason));
end $$;

-- p_lines: [{"advance_id": uuid, "amount": number}]
create or replace function workshop.save_period_deductions(p_salary_id uuid, p_lines jsonb, p_other_s114 numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ws uuid := core.current_workspace_id(); s workshop.salaries; v_cap_pct numeric; v_wages numeric;
  v_cap numeric; v_other numeric; v_total numeric := 0; l jsonb; a workshop.advances; v_amt numeric; v_bal numeric;
  r record;
begin
  if v_ws is null or not core.is_owner_or_manager() then raise exception '无权限 / Not allowed'; end if;
  select * into s from workshop.salaries where id = p_salary_id and workspace_id = v_ws for update;
  if not found then raise exception '请先保存工资记录 / Save the salary first'; end if;
  if s.paid then raise exception '工资已发放，已锁定 / Salary already paid, locked'; end if;
  v_wages := s.basic + s.allowances + s.bonus;
  if v_wages is null or v_wages <= 0 then raise exception '需要法律审核：没有当月工资资料 / Legal review needed: no wages for this month'; end if;
  select cap_percent into v_cap_pct from workshop.deduction_policy where workspace_id = v_ws;
  v_cap_pct := coalesce(v_cap_pct, 50);
  v_other := round(coalesce(p_other_s114, s.other_s114_deductions, 0), 2);
  if v_other < 0 then raise exception 'Invalid other deductions'; end if;
  v_cap := round(v_wages * v_cap_pct / 100, 2);

  -- restore previous lines for this salary
  delete from workshop.advance_deductions where salary_id = p_salary_id;

  for l in select * from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) loop
    v_amt := round((l->>'amount')::numeric, 2);
    if v_amt is null or v_amt < 0 then raise exception '金额无效 / Invalid amount'; end if;
    if v_amt = 0 then continue; end if;
    select * into a from workshop.advances where id = (l->>'advance_id')::uuid and workspace_id = v_ws for update;
    if not found or a.profile_id <> s.profile_id then raise exception '预支记录不属于此工友 / Advance does not belong to this Team Member'; end if;
    if a.is_legacy then raise exception '旧记录未核对，不能扣除 / Legacy advance not reconciled'; end if;
    if a.status::text not in ('paid','partially_settled','settled') or a.paid_at is null then
      raise exception '只扣已实际付款的预支 / Only actually paid advances can be deducted'; end if;
    v_bal := workshop.advance_balance(a.id, p_salary_id);
    if v_amt > v_bal then raise exception '扣除金额 RM % 超过未还余额 RM % / Exceeds outstanding balance', v_amt, v_bal; end if;
    insert into workshop.advance_deductions(workspace_id, advance_id, salary_id, period, amount, created_by)
      values (v_ws, a.id, p_salary_id, s.period, v_amt, auth.uid());
    v_total := v_total + v_amt;
  end loop;

  if v_total + v_other > v_cap then
    raise exception '超过第114(8)条50%%上限：上限 RM %，其他第114条扣除 RM %，预支扣除 RM % / Exceeds s.114(8) limit', v_cap, v_other, v_total;
  end if;
  if v_wages - s.deductions - v_other - v_total < 0 then raise exception '实发工资不能为负 / Net pay cannot be negative'; end if;

  update workshop.salaries set advance_deduction_total = v_total, other_s114_deductions = v_other, updated_at = now() where id = p_salary_id;

  for r in select a2.id from workshop.advances a2 where a2.workspace_id = v_ws and a2.profile_id = s.profile_id
           and a2.status::text in ('paid','partially_settled','settled') loop
    v_bal := workshop.advance_balance(r.id);
    update workshop.advances set status = (case
      when v_bal <= 0 then 'settled'
      when exists (select 1 from workshop.advance_deductions d where d.advance_id = r.id) then 'partially_settled'
      else 'paid' end)::workshop.advance_status where id = r.id;
  end loop;

  perform workshop.log_advance_event(v_ws, null, p_salary_id, 'deductions_saved',
    jsonb_build_object('lines', p_lines, 'total', v_total, 'other_s114', v_other, 'cap', v_cap, 'wages', v_wages));
  return jsonb_build_object('total', v_total, 'cap', v_cap, 'wages', v_wages, 'other_s114', v_other);
end $$;

create or replace function workshop.upsert_deduction_policy(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ws uuid := core.current_workspace_id(); v_old jsonb;
begin
  if v_ws is null or not core.is_owner() then raise exception '只有老板可以修改 / Owner only'; end if;
  if (p->>'cap_percent')::numeric is not null and ((p->>'cap_percent')::numeric <= 0 or (p->>'cap_percent')::numeric > 50) then
    raise exception '上限必须在 0–50%% 之间 / Cap must be 0–50%%'; end if;
  select to_jsonb(d) into v_old from workshop.deduction_policy d where workspace_id = v_ws;
  insert into workshop.deduction_policy as d (workspace_id, cap_percent, law_version, effective_date, exceptions, source_links,
    last_review_date, reviewer_name, note_zh, note_en, note_ms, updated_by, updated_at)
  values (v_ws, coalesce((p->>'cap_percent')::numeric, 50), coalesce(p->>'law_version','Labour Ordinance (Sarawak) Cap. 76'),
    nullif(p->>'effective_date','')::date, coalesce(p->'exceptions','[]'::jsonb), coalesce(p->'source_links','[]'::jsonb),
    nullif(p->>'last_review_date','')::date, p->>'reviewer_name', p->>'note_zh', p->>'note_en', p->>'note_ms', auth.uid(), now())
  on conflict (workspace_id) do update set cap_percent = excluded.cap_percent, law_version = excluded.law_version,
    effective_date = excluded.effective_date, exceptions = excluded.exceptions, source_links = excluded.source_links,
    last_review_date = excluded.last_review_date, reviewer_name = excluded.reviewer_name, note_zh = excluded.note_zh,
    note_en = excluded.note_en, note_ms = excluded.note_ms, updated_by = auth.uid(), updated_at = now();
  perform workshop.log_advance_event(v_ws, null, null, 'policy_updated', jsonb_build_object('old', v_old, 'new', p));
end $$;

grant execute on function workshop.advance_balance(uuid, uuid) to authenticated;
grant execute on function workshop.create_advance_on_behalf(uuid, numeric, text, text, date, text, text) to authenticated;
grant execute on function workshop.record_advance_payment(uuid, text, date, text, text) to authenticated;
grant execute on function workshop.reverse_advance(uuid, text) to authenticated;
grant execute on function workshop.save_period_deductions(uuid, jsonb, numeric) to authenticated;
grant execute on function workshop.upsert_deduction_policy(jsonb) to authenticated;
revoke execute on function workshop.one_month_wage(uuid, uuid) from public, anon;
grant execute on function workshop.one_month_wage(uuid, uuid) to authenticated;