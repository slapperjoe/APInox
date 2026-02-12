// Shared type definitions extracted from APInox models
// Only includes types needed by editor components

export interface SchemaNode {
    name: string;
    type: string;
    kind: 'complex' | 'simple';
    minOccurs?: string;
    maxOccurs?: string;
    documentation?: string;
    children?: SchemaNode[];
    options?: string[]; // Enums
    isOptional?: boolean;
    isChoice?: boolean;
    choiceGroup?: number;
}

export type RequestType = 'soap' | 'rest' | 'graphql';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type BodyType = 'xml' | 'json' | 'graphql' | 'text' | 'form-data' | 'binary' | 'none';

// Re-export types from types.ts
export * from './types';
