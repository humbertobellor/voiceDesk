-- Enable realtime for calls table (Plan 07-04)
-- D-08: Supabase Realtime subscription — portal subscribes to calls table filtered by contractor_id

ALTER PUBLICATION supabase_realtime ADD TABLE calls;