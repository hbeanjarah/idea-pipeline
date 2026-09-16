import { app } from '#app';
import { env } from '#config/env';

// Caddy relaie depuis la meme machine. Ecouter sur 0.0.0.0 exposerait l'API en
// clair a cote du HTTPS cense la couvrir.
app.listen(env.port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${env.port}`);
});
