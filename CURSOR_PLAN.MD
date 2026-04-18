# 🤖 Cursor — XRPL Escrow Engine Plan

---

## 🎯 What You Are Building

The XRPL escrow engine for an app called Aight Bet.

The app lets two people lock a commitment stake in XRP tied to a real
world goal. If they follow through and verify they showed up, they get
their money back. If they fail, the escrow expires and funds are forfeited.

You are building the three functions that power this. Nothing else.

---

## 📦 Package to Install First

```
xrpl
```

Install it. That is the only dependency for this feature.

---

## 🌐 Network

Always use the XRPL testnet. Never mainnet.

```
WebSocket:  wss://s.altnet.rippletest.net:51233
Faucet:     https://faucet.altnet.rippletest.net/accounts
```

Before writing any code, get two funded testnet wallets from the faucet.
One represents the user. One is the app-controlled pot wallet.
Save both seeds and addresses — you will need them to test.

---

## 📁 Where Files Go

```
src/
├── lib/
│   └── xrpl.ts          ← all three escrow functions live here
├── scripts/
│   └── test-escrow.ts   ← standalone test script, deleted after testing
└── types/
    └── index.ts         ← TypeScript interfaces
```

Do not create files anywhere else.

---

## ⚠️ The Most Important Thing to Know

XRPL measures time from January 1 2000.
JavaScript measures time from January 1 1970.
The difference is 946684800 seconds.

Every date passed into an XRPL transaction must be converted.
If you skip this, deadlines will be completely wrong and nothing will work.

---

## ⚙️ What Each Function Does

### Function 1 — createEscrow

**Purpose:** Lock a user's XRP into the pot wallet when they commit to a goal.

**Inputs:**
- userSeed — the user's testnet wallet seed
- potAddress — the app pot wallet address
- amountXRP — how much XRP to lock, as a string like "15"
- deadline — a JavaScript Date for when the escrow expires

**What it does:**
1. Connects to the testnet
2. Creates a wallet from userSeed
3. Converts the deadline Date to Ripple epoch time
4. Converts amountXRP to drops (1 XRP = 1,000,000 drops)
5. Builds and submits an EscrowCreate transaction
6. Returns the escrow sequence number and transaction hash

**What to save from the result:**
- escrowSequence — from prepared.Sequence — save this to the database immediately
- txHash — from result.result.hash

The escrowSequence is the only way to finish or cancel this escrow later.
Do not lose it.

**Returns:**
```
{
  escrowSequence: number
  txHash: string
}
```

---

### Function 2 — finishEscrow

**Purpose:** Release the escrowed XRP back to the user after their goal
is verified. Called by the app server, not the user.

**Inputs:**
- potWalletSeed — the app pot wallet seed
- userAddress — the wallet address of whoever created the escrow
- escrowSequence — the number saved from createEscrow

**What it does:**
1. Connects to the testnet
2. Creates a wallet from potWalletSeed
3. Builds and submits an EscrowFinish transaction
4. The Owner field must be the userAddress — not the pot wallet
5. The OfferSequence field must be the escrowSequence
6. Returns the transaction hash

**Returns:**
```
txHash: string
```

---

### Function 3 — cancelEscrow

**Purpose:** Return escrowed XRP to the user if the deadline passed and
the goal was never verified. Can only be called after CancelAfter time.

**Inputs:**
- userSeed — the user's testnet wallet seed
- userAddress — the user's wallet address
- escrowSequence — the number saved from createEscrow

**What it does:**
1. Connects to the testnet
2. Creates a wallet from userSeed
3. Builds and submits an EscrowCancel transaction
4. The Owner field must be the userAddress
5. The OfferSequence field must be the escrowSequence
6. Returns the transaction hash

**Returns:**
```
txHash: string
```

---

## 🧪 Test Script Plan

After writing xrpl.ts, write a standalone test script at
`/scripts/test-escrow.ts` that does the following:

1. Calls createEscrow with a deadline 60 seconds from now
2. Logs the escrowSequence and txHash
3. Waits 61 seconds
4. Calls finishEscrow with the saved escrowSequence
5. Logs the result

Test cancelEscrow separately:
1. Calls createEscrow with a deadline 60 seconds from now
2. Waits 61 seconds
3. Calls cancelEscrow with the saved escrowSequence
4. Logs the result

Both tests must pass before touching any API routes.
Delete the test script after both pass.

---

## 🔐 Environment Variables

Never hardcode seeds. Use environment variables.

```
XRPL_POT_WALLET_SEED=
XRPL_POT_WALLET_ADDRESS=
```

User seeds will come from the database at runtime, not from env.

---

## ✅ Definition of Done

This feature is complete when:

- createEscrow locks XRP on testnet and returns a sequence number
- finishEscrow releases that XRP and returns a tx hash
- cancelEscrow returns XRP after expiry and returns a tx hash
- All three tested end to end with real testnet transactions
- No hardcoded seeds anywhere in the codebase
- Test script deleted

Do not move on to API routes until all three pass.

---

## 🔢 Build Order

```
1. Install xrpl package
2. Get two funded testnet wallets from the faucet
3. Write xrpl.ts — createEscrow first
4. Write test script — test createEscrow in isolation
5. Add finishEscrow to xrpl.ts — test it
6. Add cancelEscrow to xrpl.ts — test it
7. All three pass — delete test script
8. Done — report back before touching anything else
```