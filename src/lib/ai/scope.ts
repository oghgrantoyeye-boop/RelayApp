// Which workspace a model call is for (T-35). currentViewer() records the request's workspace here,
// so the model adapter can count each call against that workspace's monthly budget without every AI
// task having to take an org id. Each request runs in its own async context, so scopes never mix.
import { AsyncLocalStorage } from "node:async_hooks";
import type { Db } from "../db";

export interface AiScope {
  db?: Db;
  orgId?: string;
}

const store = new AsyncLocalStorage<AiScope>();

/** Record the workspace for the rest of this request. */
export function setAiScope(db: Db, orgId: string) {
  const s = store.getStore();
  if (s) {
    s.db = db;
    s.orgId = orgId;
  } else store.enterWith({ db, orgId });
}

export function getAiScope(): AiScope | undefined {
  return store.getStore();
}

/** Run fn with its own scope; for tests and background jobs. */
export function withAiScope<T>(scope: AiScope, fn: () => Promise<T>): Promise<T> {
  return store.run({ ...scope }, fn);
}
