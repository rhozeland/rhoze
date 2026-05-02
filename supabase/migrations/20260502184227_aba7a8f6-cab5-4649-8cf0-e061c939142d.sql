UPDATE public.service_packages
SET name = btrim(regexp_replace(name, '\s*\([^)]*\)\s*', ' ', 'g'))
WHERE name ~ '\(';