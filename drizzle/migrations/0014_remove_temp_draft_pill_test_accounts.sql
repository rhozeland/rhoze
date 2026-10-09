do $$
declare
  u uuid[] := array['31ec7cc7-fc0d-44eb-afa8-412bd844ec6c','b031c28b-74be-46b6-b4d8-f6957760150b']::uuid[];
begin
  delete from public.messages where author_id = any(u);
  delete from public.milestone_messages where author_id = any(u);
  delete from public.release_posts where user_id = any(u);
  delete from public.doc_completions where user_id = any(u);
  delete from public.project_allocations where user_id = any(u);
  delete from public.project_clients where user_id = any(u);
  delete from public.saved_profiles where user_id = any(u);
  delete from public.user_wallet_pubkeys where user_id = any(u);
  delete from public.user_wallets where user_id = any(u);
  delete from public.user_roles where user_id = any(u);
  delete from public.timesheets where user_id = any(u);
  delete from public.team_availability where user_id = any(u);
  delete from public.team_invites where user_id = any(u);
  delete from public.subscriptions where user_id = any(u);
  delete from public.tasks where owner_id = any(u);
  delete from public.pay_stubs where user_id = any(u);
  delete from public.payroll_profiles where user_id = any(u);
  delete from public.profile_employment_history where user_id = any(u);
  delete from public.employee_benefits where user_id = any(u);
  delete from public.investor_pledges where user_id = any(u);
  delete from public.community_submissions where user_id = any(u);
  delete from public.copilot_conversations where user_id = any(u);
  delete from public.contacts where owner_id = any(u);
  delete from public.deals where owner_id = any(u);
  delete from public.activities where owner_id = any(u);
  delete from public.docs where target_user_id = any(u);
  delete from public.dm_threads where owner_id = any(u);
  delete from public.releases where user_id = any(u);
  delete from public.projects where owner_id = any(u);
  delete from public.brand_profiles where user_id = any(u);
  delete from public.creator_directory where user_id = any(u);
  delete from auth.users where id = any(u);
end $$;