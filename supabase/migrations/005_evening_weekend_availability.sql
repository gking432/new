-- Real home-service companies run evening and weekend inspections because most
-- homeowners work 9-to-5. Replace the weekday-daytime-only seed with coverage
-- that always includes after-5pm and weekend slots, so the AI scheduling
-- assistant never has to dead-end a "can you come after work or on a weekend?"
-- request.

-- Only adjust the default company-wide windows (user_id is null); leave any
-- per-estimator schedules an admin has set alone.
delete from availability_windows where user_id is null;

insert into availability_windows (day_of_week, start_time, end_time, appointment_type, slot_minutes)
values
  -- Weekdays: daytime through evening (until 8pm)
  (1, '09:00', '20:00', 'inspection', 60),
  (2, '09:00', '20:00', 'inspection', 60),
  (3, '09:00', '20:00', 'inspection', 60),
  (4, '09:00', '20:00', 'inspection', 60),
  (5, '09:00', '20:00', 'inspection', 60),
  -- Weekends: daytime
  (6, '09:00', '16:00', 'inspection', 60),
  (0, '09:00', '16:00', 'inspection', 60);
