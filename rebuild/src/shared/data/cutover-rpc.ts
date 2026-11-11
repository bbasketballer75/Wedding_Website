/**
 * RPC bridge for the cutover data-layer surface (tools/cutover/migrations).
 *
 * The generated `database.types.ts` is the contract baseline produced from the
 * *frozen* migration chain; the forward cutover migrations add a handful of
 * RPCs (guest-share aggregate, identity resolution, token issuance, admin
 * delete/audit). Until those migrations are part of the deployed schema and the
 * contract dumps are regenerated, TypeScript cannot know them from the
 * generated `Functions` map. This helper keeps the one unavoidable cast in a
 * single documented place; every result is parsed defensively by the caller.
 */
import type { TypedSupabaseClient } from './client'

export interface RpcError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

export interface RpcResult<T> {
  data: T
  error: RpcError | null
}

type UntypedRpc = (
  this: void,
  fn: string,
  args?: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: RpcError | null }>

/** Call a forward-migration RPC and return a discriminated result. */
export async function callCutoverRpc<T>(
  client: TypedSupabaseClient,
  fn: string,
  args: Record<string, unknown> = {}
): Promise<RpcResult<T>> {
  const rpc = client.rpc.bind(client) as unknown as UntypedRpc
  try {
    const result = await rpc(fn, args)
    return { data: result.data as T, error: result.error }
  } catch (error) {
    return {
      data: null as T,
      error: { message: error instanceof Error ? error.message : 'unknown rpc error' },
    }
  }
}
