ALTER PUBLICATION supabase_realtime ADD TABLE public.timesheet_periods;
ALTER TABLE public.timesheet_periods REPLICA IDENTITY FULL;