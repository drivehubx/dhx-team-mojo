revoke execute on function workshop.advance_balance(uuid, uuid) from public, anon;
revoke execute on function workshop.create_advance_on_behalf(uuid, numeric, text, text, date, text, text) from public, anon;
revoke execute on function workshop.record_advance_payment(uuid, text, date, text, text) from public, anon;
revoke execute on function workshop.reverse_advance(uuid, text) from public, anon;
revoke execute on function workshop.save_period_deductions(uuid, jsonb, numeric) from public, anon;
revoke execute on function workshop.upsert_deduction_policy(jsonb) from public, anon;
revoke execute on function workshop.one_month_wage(uuid, uuid) from public, anon, authenticated;
revoke execute on function workshop.log_advance_event(uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;