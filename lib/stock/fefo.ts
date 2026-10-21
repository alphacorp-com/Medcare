// First-expiry-first-out allocation of an exit across an article's lots. Pure, unit-tested
// in fefo.test.ts.

export interface LotBalance {
  id: string;
  lotNumber: string;
  expiryDate: Date | null;
  quantity: number;
}

export interface LotAllocation {
  lotId: string;
  quantity: number;
}

export type FefoPlan = { ok: true; allocations: LotAllocation[] } | { ok: false; available: number };

// Expiry dates are calendar dates (@db.Date, read back as UTC midnight): a lot can still be
// used ON its expiry date and is expired from the next day.
export function isExpired(expiryDate: Date | null, at: Date): boolean {
  if (!expiryDate) return false;
  const today = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return expiryDate.getTime() < today;
}

// Lots in consumption order: earliest expiry first, lots without expiry last, then by lot
// number so the order is stable.
export function fefoOrder<T extends LotBalance>(lots: readonly T[]): T[] {
  return [...lots].sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return a.expiryDate.getTime() - b.expiryDate.getTime() || a.lotNumber.localeCompare(b.lotNumber);
    if (a.expiryDate) return -1;
    if (b.expiryDate) return 1;
    return a.lotNumber.localeCompare(b.lotNumber);
  });
}

// Takes `quantity` from the usable lots in FEFO order. Expired lots are never handed out to a
// patient (`allowExpired` is only for recording the destruction of expired stock).
export function planFefo(lots: readonly LotBalance[], quantity: number, at: Date, { allowExpired = false } = {}): FefoPlan {
  const usable = fefoOrder(lots.filter((l) => l.quantity > 0 && (allowExpired || !isExpired(l.expiryDate, at))));
  const available = usable.reduce((sum, l) => sum + l.quantity, 0);
  if (!Number.isInteger(quantity) || quantity <= 0 || available < quantity) return { ok: false, available };

  const allocations: LotAllocation[] = [];
  let remaining = quantity;
  for (const lot of usable) {
    if (remaining === 0) break;
    const take = Math.min(lot.quantity, remaining);
    allocations.push({ lotId: lot.id, quantity: take });
    remaining -= take;
  }
  return { ok: true, allocations };
}
