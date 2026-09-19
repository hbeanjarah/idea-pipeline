-- Plus rien ne lit ni n'écrit cette colonne depuis que l'idée porte une étape :
-- elle survivait sur son DEFAULT, sans que personne la consulte. Son dernier
-- lecteur était le script de reprise, qui a tourné en production et n'existe
-- plus. Voir docs/labels-design.md.
--
-- Pas de DROP CONSTRAINT séparé : Postgres emporte ideas_status_check avec la
-- colonne à laquelle elle est attachée. Une instruction de moins qui puisse
-- échouer sur un nom.
ALTER TABLE ideas DROP COLUMN status;
