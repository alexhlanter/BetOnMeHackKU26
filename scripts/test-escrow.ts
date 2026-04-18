import { Wallet } from "xrpl";
import { createEscrow, finishEscrow } from "../src/lib/xrpl.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const userSeed = requireEnv("USER_WALLET_SEED");
  const potSeed = requireEnv("POT_WALLET_SEED");
  const potAddress = requireEnv("XRPL_POT_WALLET_ADDRESS");

  const userWallet = Wallet.fromSeed(userSeed);
  const potWallet = Wallet.fromSeed(potSeed);

  if (potWallet.address !== potAddress) {
    throw new Error(
      `POT_WALLET_SEED derives address ${potWallet.address}, ` +
        `but XRPL_POT_WALLET_ADDRESS is ${potAddress}. They must match.`
    );
  }

  // Long enough that FinishAfter is comfortably in the past AND we're still
  // well before CancelAfter by the time we call finishEscrow.
  const deadline = new Date(Date.now() + 180_000);

  console.log("── createEscrow ──");
  console.log("user address :", userWallet.address);
  console.log("pot address  :", potAddress);
  console.log("amount       : 2 XRP");
  console.log("deadline     :", deadline.toISOString());
  console.log("submitting EscrowCreate to testnet…");

  const created = await createEscrow({
    userSeed,
    potAddress,
    amountXRP: "2",
    deadline,
  });

  console.log("escrowSequence :", created.escrowSequence);
  console.log("txHash         :", created.txHash);
  console.log(
    `explorer        : https://testnet.xrpl.org/transactions/${created.txHash}`
  );
  console.log("");

  // FinishAfter is ~5s in the future from create time; wait longer than that
  // plus a safety margin so the ledger reliably advances past it.
  const waitMs = 12_000;
  console.log(`waiting ${waitMs / 1000}s for ledger to advance past FinishAfter…`);
  await sleep(waitMs);
  console.log("");

  console.log("── finishEscrow ──");
  console.log("owner          :", userWallet.address);
  console.log("offerSequence  :", created.escrowSequence);
  console.log("submitting EscrowFinish to testnet…");

  const finished = await finishEscrow({
    potWalletSeed: potSeed,
    userAddress: userWallet.address,
    escrowSequence: created.escrowSequence,
  });

  console.log("txHash         :", finished.txHash);
  console.log(
    `explorer        : https://testnet.xrpl.org/transactions/${finished.txHash}`
  );
  console.log("");
  console.log("DONE — 2 XRP should now be back in the user wallet.");
}

main().catch((err) => {
  console.error("test-escrow failed:");
  console.error(err);
  process.exit(1);
});
