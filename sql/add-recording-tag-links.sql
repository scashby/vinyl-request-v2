CREATE TABLE recording_tag_links (
  recording_id integer NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  tag_id       integer NOT NULL REFERENCES master_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recording_id, tag_id)
);

CREATE INDEX idx_recording_tag_links_tag_id ON recording_tag_links(tag_id);

-- Enable RLS (consistent with all other tables in this project)
ALTER TABLE public.recording_tag_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recording_tag_links TO anon, authenticated;

-- Open policies — single-owner admin app, no per-user ownership
CREATE POLICY recording_tag_links_select_all
  ON public.recording_tag_links FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY recording_tag_links_insert_all
  ON public.recording_tag_links FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY recording_tag_links_update_all
  ON public.recording_tag_links FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY recording_tag_links_delete_all
  ON public.recording_tag_links FOR DELETE TO anon, authenticated USING (true);
