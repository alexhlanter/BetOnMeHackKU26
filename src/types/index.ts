export interface CreateEscrowParams {
  userSeed: string;
  potAddress: string;
  amountXRP: string;
  deadline: Date;
}

export interface CreateEscrowResult {
  escrowSequence: number;
  txHash: string;
}

export interface FinishEscrowParams {
  potWalletSeed: string;
  userAddress: string;
  escrowSequence: number;
}

export interface CancelEscrowParams {
  userSeed: string;
  userAddress: string;
  escrowSequence: number;
}

export interface EscrowTxResult {
  txHash: string;
}
