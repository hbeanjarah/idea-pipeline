CREATE TABLE ideas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status      text        NOT NULL DEFAULT 'captured'
                          CONSTRAINT ideas_status_check
                          CHECK (status IN ('captured', 'maturing', 'ready', 'published')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE variations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id     uuid        NOT NULL REFERENCES ideas (id) ON DELETE CASCADE,
  position    integer     NOT NULL,
  text        text        NOT NULL CHECK (btrim(text) <> ''),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, position)
);

CREATE INDEX variations_idea_id_idx ON variations (idea_id);
CREATE INDEX ideas_updated_at_idx ON ideas (updated_at DESC, id DESC);
