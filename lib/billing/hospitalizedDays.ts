// Days actually spent in hospital, billed per started 24h period, at least one. Shared by
// the discharge regularisation (server) and the "Sorties" page (client) so both always agree.
export function hospitalizedDays(hospitalizedAt: Date, leftAt: Date): number {
  const elapsed = leftAt.getTime() - hospitalizedAt.getTime();
  return Math.max(1, Math.ceil(elapsed / (24 * 60 * 60 * 1000)));
}
