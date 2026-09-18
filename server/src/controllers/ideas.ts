import type { RequestHandler } from 'express';

import { userIdOf } from '#middleware/auth';
import * as ideaService from '#services/ideas';

type IdeaParams = { id: string };
type VariationParams = { id: string; variationId: string };

export const list: RequestHandler = async (req, res) => {
  res.status(200).json(await ideaService.listIdeas(userIdOf(req)));
};

export const create: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(await ideaService.createIdea(userIdOf(req), req.body));
};

export const remove: RequestHandler<IdeaParams> = async (
  req,
  res,
) => {
  await ideaService.deleteIdea(userIdOf(req), req.params.id);
  res.status(204).end();
};

export const setLabel: RequestHandler<IdeaParams> = async (
  req,
  res,
) => {
  res
    .status(200)
    .json(
      await ideaService.setIdeaLabel(
        userIdOf(req),
        req.params.id,
        req.body,
      ),
    );
};

export const addVariation: RequestHandler<IdeaParams> = async (
  req,
  res,
) => {
  res
    .status(201)
    .json(
      await ideaService.addVariation(
        userIdOf(req),
        req.params.id,
        req.body,
      ),
    );
};

export const editVariation: RequestHandler<VariationParams> = async (
  req,
  res,
) => {
  res
    .status(200)
    .json(
      await ideaService.editVariation(
        userIdOf(req),
        req.params.id,
        req.params.variationId,
        req.body,
      ),
    );
};
