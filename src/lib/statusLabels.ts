import type { Status } from '@/storage/types';

// Record<Status, string> et pas un objet libre : ajouter une étape au domaine
// casse la compilation ici, au lieu de laisser un libellé vide arriver à
// l'écran.
export const STATUS_LABELS: Record<Status, string> = {
  captured: 'Capturé',
  maturing: 'Maturation',
  ready: 'Prêt',
  published: 'Publié',
};

// Les transitions restent libres : toute étape est atteignable depuis toute
// autre. Cet ordre n'est qu'un ordre d'affichage.
export const STATUS_ORDER: Status[] = [
  'captured',
  'maturing',
  'ready',
  'published',
];
