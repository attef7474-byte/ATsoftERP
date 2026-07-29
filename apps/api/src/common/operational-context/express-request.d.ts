import { ActiveOperationalContext } from './operational-context.types';

declare global {
  namespace Express {
    interface Request {
      activeContext?: ActiveOperationalContext;
    }
  }
}

export {};
