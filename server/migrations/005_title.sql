-- Scellée par store/notes.ts, contexte = l'id de l'idée. Ne jamais indexer :
-- chaque scellement utilise un IV neuf, donc deux titres identiques écrivent
-- deux valeurs différentes et l'index ne verrait rien.
ALTER TABLE ideas ADD COLUMN title text;
