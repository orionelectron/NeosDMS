import { randomUUID } from 'crypto';
import type { ClsModuleOptions } from 'nestjs-cls';
import type { Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export const clsModuleOptions: ClsModuleOptions = {
  global: true,
  middleware: {
    mount: true,
    generateId: true,
    idGenerator: (req: Request) =>
      (req.headers[REQUEST_ID_HEADER] as string | undefined) || randomUUID(),
    setup: (cls, _req: Request, res: Response) => {
      res.setHeader(REQUEST_ID_HEADER, cls.getId() ?? 'unknown');
    },
  },
};
