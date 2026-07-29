import { SetMetadata } from '@nestjs/common';

export const OPERATIONAL_CONTEXT_OPTIONAL_KEY = 'operationalContextOptional';
export const OperationalContextOptional = () =>
  SetMetadata(OPERATIONAL_CONTEXT_OPTIONAL_KEY, true);
