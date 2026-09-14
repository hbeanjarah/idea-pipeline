CREATE TABLE users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  text        NOT NULL UNIQUE,
  email       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    text        NOT NULL UNIQUE,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Base de développement uniquement : rien n'est déployé, et ces lignes sont des
-- tests. Une migration destructrice serait inacceptable sur un système en
-- service — ne pas recopier ce DELETE ailleurs sans y réfléchir.
DELETE FROM ideas;

ALTER TABLE ideas ADD COLUMN user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE;

CREATE INDEX ideas_user_id_updated_at_idx ON ideas (user_id, updated_at DESC, id DESC);
DROP INDEX ideas_updated_at_idx;  -- plus aucune requête ne liste sans filtrer sur user_id
