import type { AppConfig } from '../config.js';
export interface TransferAccount { id: string; holder: string; alias: string; cbu: string }
export function transferAccounts(cfg: AppConfig): TransferAccount[] {
  return [
    { id: 'primary', holder: cfg.transferHolder, alias: cfg.transferAlias, cbu: cfg.transferCbu },
    { id: 'secondary', holder: cfg.transferHolder2, alias: cfg.transferAlias2, cbu: cfg.transferCbu2 },
  ].filter(account => account.holder && (account.alias || account.cbu));
}
