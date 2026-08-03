export interface KvNamespaceLike {
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  YEAR_CLOCK_KV?: KvNamespaceLike;
  ASSETS?: AssetFetcher;
}

export interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface PagesContext<Environment> extends WaitUntilContext {
  request: Request;
  env: Environment;
  params: Record<string, string | string[]>;
}

export type PagesFunction<Environment> = (
  context: PagesContext<Environment>,
) => Response | Promise<Response>;