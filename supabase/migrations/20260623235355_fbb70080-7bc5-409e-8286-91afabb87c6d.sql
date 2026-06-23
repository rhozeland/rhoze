INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'marketing'::app_role
FROM auth.users u
WHERE (
  u.email = 'indolestic@rhozeland.com'
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin')
)
ON CONFLICT (user_id, role) DO NOTHING;