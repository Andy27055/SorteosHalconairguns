// The pg adapter can surface a commit conflict without Prisma's P2034 wrapper.
export function transactionConflict(error: unknown): boolean {
  const value = error as { code?: string; cause?: { kind?: string } } | null;
  return value?.code === 'P2034' || value?.cause?.kind === 'TransactionWriteConflict';
}
