CREATE TABLE labels (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Scellé (store/notes.ts). Ne jamais indexer en UNIQUE : chaque scellement
  -- utilise un IV neuf, donc deux « Prêt » y écrivent deux valeurs différentes
  -- et la contrainte ne verrait rien. Les doublons se refusent dans le service.
  name        text        NOT NULL,

  -- Un rang dans une palette, pas une couleur : les valeurs vivent dans
  -- src/styles/tokens.css.
  color       integer     NOT NULL CHECK (color BETWEEN 1 AND 8),

  -- Ne pas y ajouter d'unicité : réordonner échange des positions et la
  -- violerait en cours de transaction.
  position    integer     NOT NULL,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX labels_user_id_idx ON labels (user_id, position);

CREATE TABLE idea_labels (
  idea_id   uuid  NOT NULL REFERENCES ideas  (id) ON DELETE CASCADE,

  -- Ne pas passer en RESTRICT : c'est ce CASCADE qui libère les idées quand
  -- leur étape est supprimée, au lieu d'empêcher la suppression.
  label_id  uuid  NOT NULL REFERENCES labels (id) ON DELETE CASCADE,

  PRIMARY KEY (idea_id, label_id),

  -- Ne pas supprimer en croyant doublonner la clé primaire : celle-ci autorise
  -- plusieurs étapes par idée, c'est cette contrainte qui limite à une.
  -- Voir docs/labels-design.md.
  CONSTRAINT idea_labels_one_per_idea UNIQUE (idea_id)
);

CREATE INDEX idea_labels_label_id_idx ON idea_labels (label_id);
