import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { sendXRP } from "../services/xrpl/transaction/sendXRP.js";
import { sendIOU } from "../services/xrpl/transaction/sendIOU.js";
import { sendCrossCurrency } from "../services/xrpl/transaction/sendCrossCurrency.js";
import { getAccountTransactions } from "../services/xrpl/transaction/getAccountTransactions.js";

const sendXrpBody = z.object({
  walletAddress: z.string().min(25),
  destination: z.string().min(25).optional(),
  destinationUsername: z.string().min(1).optional(),
  xrpAmount: z.number().positive(),
  destinationTag: z.number().int().nonnegative().optional(),
});

const sendIouBody = z.object({
  walletAddress: z.string().min(25),
  destination: z.string().min(25).optional(),
  destinationUsername: z.string().min(1).optional(),
  currency: z.string().min(3),
  issuer: z.string().min(25),
  value: z.string(),
});

async function resolveRecipient(
  app: FastifyInstance,
  destination?: string,
  destinationUsername?: string,
): Promise<string> {
  if (destination) return destination;
  if (!destinationUsername) {
    throw new HttpError(400, "Either destination or destinationUsername is required");
  }
  const { data: profile } = await app.supabase
    .from("profiles")
    .select("id")
    .eq("username", destinationUsername)
    .maybeSingle();
  if (!profile) throw new HttpError(404, "Recipient not found");
  const { data: walletRow } = await app.supabase
    .from("wallets")
    .select("classic_address")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (!walletRow) throw new HttpError(404, "Recipient has no wallet");
  return walletRow.classic_address as string;
}

const crossCurrencyBody = z.object({
  walletAddress: z.string().min(25),
  destination: z.string().min(25).optional(),
  destinationUsername: z.string().min(1).optional(),
  sendCurrency: z.string().min(3),
  receiveCurrency: z.string().min(3),
  issuerAddress: z.string().min(25),
  mode: z.enum(["exact_input", "exact_output"]),
  sendAmount: z.number().positive().optional(),
  exactOutputAmount: z.number().positive().optional(),
  slippagePercent: z.number().min(0).max(50).optional(),
  destinationTag: z.number().int().nonnegative().optional(),
});

export async function transactionRoutes(app: FastifyInstance) {
  app.post("/xrp", async (req) => {
    const user = await app.requireAuth(req);
    const parse = sendXrpBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    const destinationAddress = await resolveRecipient(
      app,
      parse.data.destination,
      parse.data.destinationUsername,
    );

    return sendXRP(
      client,
      wallet,
      destinationAddress,
      parse.data.xrpAmount,
      parse.data.destinationTag,
    );
  });

  app.get("/:address/history", async (req) => {
    await app.requireAuth(req);
    const params = z.object({ address: z.string().min(25) }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const query = z
      .object({
        limit: z.coerce.number().int().positive().max(50).optional(),
        marker: z.string().optional(),
      })
      .safeParse(req.query ?? {});
    if (!query.success) throw new HttpError(400, "Invalid query");

    const client = await app.ensureXrplConnected();
    return getAccountTransactions(
      client,
      params.data.address,
      query.data.limit ?? 30,
      query.data.marker ?? null,
    );
  });

  app.post("/iou", async (req) => {
    const user = await app.requireAuth(req);
    const parse = sendIouBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    const destinationAddress = await resolveRecipient(
      app,
      parse.data.destination,
      parse.data.destinationUsername,
    );

    return sendIOU(client, wallet, destinationAddress, {
      currency: parse.data.currency,
      issuer: parse.data.issuer,
      value: parse.data.value,
    });
  });

  app.post("/cross-currency", async (req) => {
    const user = await app.requireAuth(req);
    const parse = crossCurrencyBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const { data } = parse;
    if (!data.destination && !data.destinationUsername) {
      throw new HttpError(400, "Either destination or destinationUsername is required");
    }
    if (data.mode === "exact_input" && !data.sendAmount) {
      throw new HttpError(400, "sendAmount is required for exact_input");
    }
    if (data.mode === "exact_output" && !data.exactOutputAmount) {
      throw new HttpError(400, "exactOutputAmount is required for exact_output");
    }
    if (data.sendCurrency === data.receiveCurrency) {
      throw new HttpError(400, "sendCurrency and receiveCurrency must differ");
    }

    const client = await app.ensureXrplConnected();
    const destinationAddress = await resolveRecipient(
      app,
      data.destination,
      data.destinationUsername,
    );

    const { wallet, userId } = await loadWalletByAddress(app.supabase, data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") {
      throw new HttpError(403, "Wallet does not belong to you");
    }

    return sendCrossCurrency({
      client,
      senderWallet: wallet,
      destinationAddress,
      sendCurrency: data.sendCurrency,
      receiveCurrency: data.receiveCurrency,
      issuerAddress: data.issuerAddress,
      mode: data.mode,
      sendAmount: data.sendAmount,
      exactOutputAmount: data.exactOutputAmount,
      slippagePercent: data.slippagePercent,
      destinationTag: data.destinationTag,
    });
  });
}
