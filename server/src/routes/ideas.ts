import { Router } from 'express';

import * as ideasController from '#controllers/ideas';

export const ideasRouter = Router();

ideasRouter.get('/', ideasController.list);

ideasRouter.post('/', ideasController.create);

ideasRouter.delete('/:id', ideasController.remove);

ideasRouter.patch('/:id', ideasController.setLabel);

ideasRouter.patch('/:id/title', ideasController.setTitle);

ideasRouter.post('/:id/variations', ideasController.addVariation);

ideasRouter.patch(
  '/:id/variations/:variationId',
  ideasController.editVariation,
);
