import type { RequestHandler } from 'express';

import * as ideaService from '#services/ideas';

export const list: RequestHandler = async (_req, res) => {
  res.status(200).json(await ideaService.listIdeas());
};

export const create: RequestHandler = async (req, res) => {
  res.status(201).json(await ideaService.createIdea(req.body));
};
