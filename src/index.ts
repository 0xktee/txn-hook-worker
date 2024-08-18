import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { PublicKey } from "@solana/web3.js";
import { BorshCoder, BN } from "@coral-xyz/anchor";
import { base64 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import bs58 from "bs58";

import idl from "./util/pump-fun.json";
import { publishToChannel } from "./discord";

const PUMPFUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const SOL_TOKEN_DECIMAL = 9;
const PUMPFUN_TOKEN_DECIMAL = 6;

type Bindings = {
  KV: KVNamespace;
  KV_EXPIRATION_SECONDS: number;
  DISCORD_WEBHOOK_URL: string;
  AUTH_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  bearerAuth({
    verifyToken: async (token, c) => {
      return token === c.env.AUTH_TOKEN;
    },
  })
);

app.post("/", async (c) => {
  const request = await c.req.json();
  const transaction = request[0];

  if (transaction.type === "SWAP") {
    await fetch(c.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Webhook",
        content: `${transaction.description}`,
      }),
    });
  }

  if (transaction.type === "TRANSFER") {
    const signature = transaction.signature;
    const cache = await c.env.KV.get(signature);
    if (cache) {
      return c.text(`Calling with duplicated signature within ${c.env.KV_EXPIRATION_SECONDS}`, 400);
    }

    const lastInstruction = transaction.instructions.at(-1);
    if (!lastInstruction) {
      return c.text("Last instruction not existed", 400);
    }

    if (lastInstruction.programId === PUMPFUN_PROGRAM_ID) {
      const lastInnerInstruction = lastInstruction.innerInstructions.at(-1)?.data;
      if (!lastInnerInstruction) {
        return c.text(`Last inner instruction not existed`, 400);
      }

      // temporary put signature into KV for 1 minute
      // background -> helius webhook will call multiple times with the same signature because there are multiple TRANSFER related in one transaction
      // this is limitation since can't use SWAP for PUMPFUN program
      await c.env.KV.put(signature, "TRANSFER", { expirationTtl: c.env.KV_EXPIRATION_SECONDS });

      let buffer = Buffer.from(bs58.decode(lastInnerInstruction));
      buffer = buffer.subarray(8); // remove first 8 bytes for the event cpi

      const decodedArgs = new BorshCoder(idl as any).events.decode(base64.encode(buffer));
      const data = decodedArgs?.data;

      publishToChannel(c.env.DISCORD_WEBHOOK_URL, {
        isBuy: data.isBuy,
        userAddress: new PublicKey(data.user).toString(),
        solAmount: new BN(data.solAmount).toNumber() / 10 ** SOL_TOKEN_DECIMAL,
        tokenAddress: new PublicKey(data.mint).toString(),
        tokenSymbol: transaction.description.split(" ")[3],
        tokenAmount: new BN(data.tokenAmount).toNumber() / 10 ** PUMPFUN_TOKEN_DECIMAL,
        signature: transaction.signature,
      });
    }
  }

  return c.text("PUBLISHED!", 200);
});

export default app;
