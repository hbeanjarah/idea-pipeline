import type { RequestHandler } from 'express';

import * as ideaService from '#services/ideas';

type IdeaParams = { id: string };
type VariationParams = { id: string; variationId: string };

export const list: RequestHandler = async (_req, res) => {
  res.status(200).json(await ideaService.listIdeas());
};

export const create: RequestHandler = async (req, res) => {
  res.status(201).json(await ideaService.createIdea(req.body));
};

export const remove: RequestHandler<IdeaParams> = async (
  req,
  res,
) => {
  await ideaService.deleteIdea(req.params.id);
  res.status(204).end();
};

export const changeStatus: RequestHandler<IdeaParams> = async (
  req,
  res,
) => {
  res
    .status(200)
    .json(await ideaService.changeStatus(req.params.id, req.body));
};

export const addVariation: RequestHandler<IdeaParams> = async (
  req,
  res,
) => {
  res
    .status(201)
    .json(await ideaService.addVariation(req.params.id, req.body));
};

export const editVariation: RequestHandler<VariationParams> = async (
  req,
  res,
) => {
  res
    .status(200)
    .json(
      await ideaService.editVariation(
        req.params.id,
        req.params.variationId,
        req.body,
      ),
    );
};
