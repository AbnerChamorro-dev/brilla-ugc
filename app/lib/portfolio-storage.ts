// Local copies are recovery data, never authority over a newer server revision.
export type DraftCopy<T> = { content: T; baseUpdatedAt: string | null; dirty: boolean };

export function portfolioDraftKey(owner: string | null) {
  return `brilla-portfolio-v4:${owner ?? "guest"}`;
}

export function portfolioAssetDatabase(owner: string | null) {
  return `brilla-assets-v2:${owner ?? "guest"}`;
}

export function readDraft<T>(storage: Pick<Storage, "getItem">, owner: string | null): DraftCopy<T> | null {
  try {
    const value = JSON.parse(storage.getItem(portfolioDraftKey(owner)) ?? "null");
    if (!value || typeof value.content !== "object" || !value.content || Array.isArray(value.content)) return null;
    return value;
  } catch { return null; }
}

export function writeDraft<T>(storage: Pick<Storage, "setItem">, owner: string | null, draft: DraftCopy<T>) {
  try {
    storage.setItem(portfolioDraftKey(owner), JSON.stringify(draft));
    return true;
  } catch { return false; }
}

export function chooseDraft<T>(remote: T, updatedAt: string, local: DraftCopy<T> | null) {
  const differs = local?.dirty && JSON.stringify(local.content) !== JSON.stringify(remote);
  const resume = differs && local.baseUpdatedAt === updatedAt;
  return { content: resume ? local.content : remote, conflict: differs && !resume ? local : null };
}

// Both autosave and publication use this queue, so an older request cannot finish last.
export function createSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = tail.then(operation);
    tail = next.catch(() => undefined);
    return next;
  };
}
