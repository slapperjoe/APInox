// Shared type definitions extracted from APInox models
// Only includes types needed by editor components

// Re-export SchemaNode from canonical location to avoid duplication
export type { SchemaNode } from '../../../shared/src/models';

export type RequestType = 'soap' | 'rest' | 'graphql';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type BodyType = 'xml' | 'json' | 'graphql' | 'text' | 'form-data' | 'binary' | 'none';

// Re-export types from types.ts
export * from './types';
