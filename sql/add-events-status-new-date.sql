-- The announced replacement date for a postponed event.
--
-- A postponed event keeps its original date (that's the night people had in
-- their calendar, and it's what the stamp sits on). Once the new date is
-- known, it goes here: the public pages then show the original date struck
-- through alongside "New date: ...", and the admin can move the event onto
-- that date and return it to 'scheduled' in one step.
--
-- Only meaningful while status = 'postponed'; cleared whenever the status
-- moves back to 'scheduled' or to 'cancelled'.

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status_new_date date;
