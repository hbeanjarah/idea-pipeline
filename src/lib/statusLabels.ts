import type { Status } from '@/storage/types';

// Les seuls libellés français des étapes. Trois copies vivaient auparavant dans
// StatusPicker, StatusFilter et HomeScreen, chacune priée de rester synchrone
// des deux autres à la main.
//
// Record<Status, string> fait le travail : ajouter une étape au domaine casse
// la compilation ici, au lieu de laisser un libellé manquant arriver à l'écran.
export const STATUS_LABELS: Record<Status, string> = {
  captured: 'Capturé',
  maturing: 'Maturation',
  ready: 'Prêt',
  published: 'Publié',
};

// Ordre du pipeline. Les transitions restent libres : toute étape est
// atteignable depuis toute étape.
export const STATUS_ORDER: Status[] = [
  'captured',
  'maturing',
  'ready',
  'published',
];
