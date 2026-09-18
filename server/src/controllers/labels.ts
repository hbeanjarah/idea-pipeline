import type { RequestHandler } from 'express';

import { userIdOf } from '#middleware/auth';
import * as labelService from '#services/labels';

type LabelParams = { id: string };

export const list: RequestHandler = async (req, res) => {
  res.status(200).json(await labelService.listLabels(userIdOf(req)));
};

export const create: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(await labelService.createLabel(userIdOf(req), req.body));
};

export const reorder: RequestHandler = async (req, res) => {
  res
    .status(200)
    .json(await labelService.reorderLabels(userIdOf(req), req.body));
};

export const rename: RequestHandler<LabelParams> = async (
  req,
  res,
) => {
  res
    .status(200)
    .json(
      await labelService.renameLabel(
        userIdOf(req),
        req.params.id,
        req.body,
      ),
    );
};

export const remove: RequestHandler<LabelParams> = async (
  req,
  res,
) => {
  await labelService.deleteLabel(userIdOf(req), req.params.id);
  res.status(204).end();
};
