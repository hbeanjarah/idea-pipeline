import { app } from '#app';
import { env, noteKey } from '#config/env';

// Lue avant d'ecouter : sans ca l'API demarrerait et n'echouerait qu'a la
// premiere idee enregistree, en production, chez un utilisateur.
noteKey();

// Caddy relaie depuis la meme machine. Ecouter sur 0.0.0.0 exposerait l'API en
// clair a cote du HTTPS cense la couvrir.
app.listen(env.port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${env.port}`);
});
