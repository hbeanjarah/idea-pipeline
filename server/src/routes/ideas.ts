import { Router } from 'express';

import * as ideasController from '#controllers/ideas';

export const ideasRouter = Router();

ideasRouter.get('/', ideasController.list);
ideasRouter.post('/', ideasController.create);
