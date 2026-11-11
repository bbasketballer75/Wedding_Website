/**
 * Derived type helpers over the generated `Database` type.
 *
 * Everything in the data layer derives its row/RPC types from here so the
 * generated baseline remains the single source of truth (QUALITY_BAR: no
 * hand-written duplicate row interfaces). Import `Database` directly when a
 * module only needs the top-level type.
 */
import type { Database, Json } from './database.types'

export type { Database, Json }

export type PublicSchema = Database['public']
export type PublicTables = PublicSchema['Tables']
export type PublicFunctions = PublicSchema['Functions']

/** Row type of a `public` table, e.g. `TableRow<'photos'>`. */
export type TableRow<TableName extends keyof PublicTables> = PublicTables[TableName]['Row']

/** Insert payload type of a `public` table. */
export type TableInsert<TableName extends keyof PublicTables> = PublicTables[TableName]['Insert']

/** Update payload type of a `public` table. */
export type TableUpdate<TableName extends keyof PublicTables> = PublicTables[TableName]['Update']

/** Declared return type of a `public` RPC (array for set-returning functions). */
export type RpcReturns<FunctionName extends keyof PublicFunctions> =
  PublicFunctions[FunctionName]['Returns']

/** Element type of a set-returning RPC. */
export type RpcRow<FunctionName extends keyof PublicFunctions> =
  RpcReturns<FunctionName> extends (infer Row)[] ? Row : RpcReturns<FunctionName>

/** A JSON object value as stored in `jsonb` columns. */
export type JsonObject = { [key: string]: Json | undefined }

/** Narrow an arbitrary JSON value to a plain object (arrays/null are rejected). */
export function isJsonObject(value: Json | undefined | null): value is JsonObject {
  return toJsonObject(value) !== null
}

/** Coerce an arbitrary runtime value to a JSON object, or `null`. */
export function toJsonObject(value: unknown): JsonObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as JsonObject
}

/** Coerce a JSON value to an array of unknown entries, or `null`. */
export function toUnknownArray(value: Json | undefined | null): unknown[] | null {
  if (!Array.isArray(value)) return null
  return value
}

/** Read a string field from a JSON object, or `null` when absent/mistyped. */
export function readJsonString(record: JsonObject, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

/** Read a finite number field from a JSON object, or `null` when absent/mistyped. */
export function readJsonNumber(record: JsonObject, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Read a number field from a JSON object, falling back when absent/mistyped. */
export function readJsonNumberOr(record: JsonObject, key: string, fallback: number): number {
  return readJsonNumber(record, key) ?? fallback
}
