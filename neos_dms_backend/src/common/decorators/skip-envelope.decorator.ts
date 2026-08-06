import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'neos:skipEnvelope';

export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
