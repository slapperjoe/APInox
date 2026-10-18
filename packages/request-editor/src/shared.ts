// Shared type definitions extracted from APInox models
// Only includes types needed by editor components.
//
// RequestType/HttpMethod/BodyType were defined in three places (models.ts,
// types.ts and this file). They are canonical in @shared/models and reach this
// module through the types.ts re-export below, so nothing is declared here.
export type { SchemaNode } from '@shared/models';

// Re-export types from types.ts
export * from './types';
