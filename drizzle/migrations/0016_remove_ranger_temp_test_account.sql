do $$
declare
  uid uuid := 'e6ec9162-2b31-43ff-b4f5-fb87274b33a1';
begin
  delete from public.creator_directory where user_id = uid;
  delete from public.user_roles where user_id = uid;
  delete from auth.users where id = uid;
end $$;