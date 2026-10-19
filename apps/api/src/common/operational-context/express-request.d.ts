import { ActiveOperationalContext, OperationalContextMode } from './operational-context.types';

declare global {
  namespace Express {
    interface Request {
      activeContext?: ActiveOperationalContext;
      activeContextMode?: OperationalContextMode;
    }
  }
}

export {};
