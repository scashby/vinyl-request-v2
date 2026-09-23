-- Adds a lifecycle status to events so individual events (or a whole
-- recurring series) can be marked postponed or cancelled instead of being
-- deleted. Public event surfaces stamp the event artwork with a
-- POSTPONED / CANCELLED overlay while leaving the event in place.
--
-- status_note is an optional line of admin copy shown alongside the stamp
-- on the event detail page (e.g. "New date coming in October").

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status_note text;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

-- Guard the column at the database level so a bad client write can't put an
-- unrenderable value in front of the public site.
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE public.events
ADD CONSTRAINT events_status_check
CHECK (status IN ('scheduled', 'postponed', 'cancelled'));

-- Existing rows predate the column; they are all scheduled.
UPDATE public.events SET status = 'scheduled' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS events_status_idx ON public.events (status);
