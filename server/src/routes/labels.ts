import { Router } from 'express';

import * as labelsController from '#controllers/labels';

export const labelsRouter = Router();

labelsRouter.get('/', labelsController.list);

labelsRouter.post('/', labelsController.create);

labelsRouter.patch('/', labelsController.reorder);

labelsRouter.patch('/:id', labelsController.rename);

labelsRouter.delete('/:id', labelsController.remove);
