import { Request, Response } from 'express';

export const getHealth = (req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
  });
};
