import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  GetPurchaseEntryStatusParams,
  GetPurchaseEntryStatusResponse,
  ListPurchaseEntriesResponse,
  SendPurchasePriceEmailBody,
  SendPurchasePriceEmailResponse,
} from "@workspace/api-zod";
import { db, purchaseEntriesTable, suppliersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const connectors = new ReplitConnectors();
const sendWindowMs = 60_000;
const maxSendsPerWindow = 5;
const sendWindows = new Map<string, { count: number; expiresAt: number }>();
const replyPollIntervalMs = 60_000;
let replyPollRunning = false;

function reserveSendAttempt(clientId: string, now = Date.now()) {
  if (sendWindows.size > 1_000) {
    for (const [key, window] of sendWindows) {
      if (window.expiresAt <= now) sendWindows.delete(key);
    }
  }
  const current = sendWindows.get(clientId);
  if (!current || current.expiresAt <= now) {
    sendWindows.set(clientId, { count: 1, expiresAt: now + sendWindowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= maxSendsPerWindow) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function headerValue(headers: unknown, name: string): string {
  if (!Array.isArray(headers)) return "";
  const header = headers.find(
    (value): value is { name: string; value: string } =>
      typeof value === "object" &&
      value !== null &&
      "name" in value &&
      "value" in value &&
      typeof value.name === "string" &&
      typeof value.value === "string" &&
      value.name.toLowerCase() === name.toLowerCase(),
  );
  return header?.value ?? "";
}

function plainTextFromPayload(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const part = payload as {
    mimeType?: unknown;
    body?: { data?: unknown };
    parts?: unknown;
  };
  const ownText =
    part.mimeType === "text/plain" && typeof part.body?.data === "string"
      ? Buffer.from(part.body.data, "base64url").toString("utf8")
      : "";
  const childText = Array.isArray(part.parts)
    ? part.parts.map(plainTextFromPayload).join("\n")
    : "";
  return [ownText, childText].filter(Boolean).join("\n");
}

function isApproval(text: string): boolean {
  const replyText = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .split(/\r?\n\s*On .+wrote:\s*$/im)[0]
    ?.trim()
    .replace(/\s+/g, " ");
  return /^approved[.!]?$/i.test(replyText ?? "");
}

async function checkPurchaseEntryReply(purchaseEntryId: string) {
  const [entry] = await db
    .select()
    .from(purchaseEntriesTable)
    .where(eq(purchaseEntriesTable.id, purchaseEntryId))
    .limit(1);
  if (!entry || entry.status === "Approved") return entry;

  const response = await connectors.proxy(
    "google-mail",
    `/gmail/v1/users/me/threads/${encodeURIComponent(entry.gmailThreadId)}?format=full`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new Error(`Gmail thread lookup failed with status ${response.status}`);
  }
  const thread: unknown = await response.json();
  const messages =
    typeof thread === "object" &&
    thread !== null &&
    "messages" in thread &&
    Array.isArray(thread.messages)
      ? thread.messages
      : [];
  const approvedReply = messages.some((message) => {
    if (typeof message !== "object" || message === null) return false;
    const item = message as {
      labelIds?: unknown;
      payload?: unknown;
    };
    if (Array.isArray(item.labelIds) && item.labelIds.includes("SENT")) return false;
    const from = headerValue(
      (item.payload as { headers?: unknown } | undefined)?.headers,
      "From",
    );
    const senderMatch = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
    if (senderMatch.toLowerCase() !== entry.recipient.toLowerCase()) return false;
    return isApproval(plainTextFromPayload(item.payload));
  });

  if (!approvedReply) return entry;
  const [updated] = await db
    .update(purchaseEntriesTable)
    .set({ status: "Approved" })
    .where(eq(purchaseEntriesTable.id, purchaseEntryId))
    .returning();
  return updated ?? entry;
}

export function startPurchaseEntryReplyMonitor() {
  const poll = async () => {
    if (replyPollRunning) return;
    replyPollRunning = true;
    try {
      const pendingEntries = await db
        .select({ id: purchaseEntriesTable.id })
        .from(purchaseEntriesTable)
        .where(eq(purchaseEntriesTable.status, "Sent"))
        .orderBy(asc(purchaseEntriesTable.createdAt));
      for (const entry of pendingEntries) {
        try {
          await checkPurchaseEntryReply(entry.id);
        } catch (error) {
          logger.warn(
            { errorName: error instanceof Error ? error.name : "UnknownError" },
            "Could not check a purchase entry reply",
          );
        }
      }
    } catch (error) {
      logger.error(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Purchase entry reply monitor failed",
      );
    } finally {
      replyPollRunning = false;
    }
  };
  setTimeout(() => void poll(), 5_000);
  setInterval(() => void poll(), replyPollIntervalMs);
}

router.get("/purchase-entry", async (_req, res): Promise<void> => {
  const entries = await db
    .select({
      id: purchaseEntriesTable.id,
      supplierId: purchaseEntriesTable.supplierId,
      supplierName: purchaseEntriesTable.supplierName,
      itemName: purchaseEntriesTable.itemName,
      price: purchaseEntriesTable.price,
      orderNumber: purchaseEntriesTable.orderNumber,
      recipient: purchaseEntriesTable.recipient,
      status: purchaseEntriesTable.status,
      createdAt: purchaseEntriesTable.createdAt,
    })
    .from(purchaseEntriesTable)
    .orderBy(desc(purchaseEntriesTable.createdAt))
    .limit(50);

  res.json(
    ListPurchaseEntriesResponse.parse(
      entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    ),
  );
});

router.post("/purchase-entry/email", async (req, res): Promise<void> => {
  const parsed = SendPurchasePriceEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [supplier] = await db
    .select({
      supplierId: suppliersTable.supplierId,
      supplierName: suppliersTable.supplierName,
      contact: suppliersTable.contact,
      paymentTerms: suppliersTable.paymentTerms,
    })
    .from(suppliersTable)
    .where(eq(suppliersTable.supplierId, parsed.data.supplierId))
    .limit(1);

  if (!supplier) {
    res.status(404).json({ error: "Supplier not found." });
    return;
  }
  const recipient = supplier.contact;

  const sendAttempt = reserveSendAttempt(req.ip || "unknown");
  if (!sendAttempt.allowed) {
    res.setHeader("Retry-After", String(sendAttempt.retryAfterSeconds));
    res.status(429).json({ error: "Email send limit reached. Wait before trying again." });
    return;
  }

  const itemName = parsed.data.itemName.trim().replace(/[\r\n]+/g, " ");
  const price = Number(parsed.data.price).toFixed(2);
  const orderNumber = `ORD-${new Date().getFullYear()}-${randomBytes(8).toString("hex").toUpperCase()}`;
  const emailBody = [
    "Capture a price",
    "",
    `Order Number: ${orderNumber}`,
    `Supplier: ${supplier.supplierName} (${supplier.supplierId})`,
    `Item: ${itemName}`,
    `Unit price: $${price}`,
    `Payment terms: ${supplier.paymentTerms}`,
  ].join("\r\n");
  const encodedBody = Buffer.from(emailBody, "utf8")
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\r\n") ?? "";
  const rawMessage = [
    `To: ${recipient}`,
    `Subject: Purchase price request - ${orderNumber}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");

  try {
    const response = await connectors.proxy(
      "google-mail",
      "/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: Buffer.from(rawMessage, "utf8").toString("base64url"),
        }),
      },
    );

    if (!response.ok) {
      req.log.warn(
        { gmailStatus: response.status },
        "Gmail rejected purchase price email",
      );
      res.status(502).json({
        error: "Gmail did not accept the email. Check the connection before retrying.",
      });
      return;
    }

    const sentMessage: unknown = await response.json();
    const gmailThreadId =
      typeof sentMessage === "object" &&
      sentMessage !== null &&
      "threadId" in sentMessage &&
      typeof sentMessage.threadId === "string"
        ? sentMessage.threadId
        : "";
    if (!gmailThreadId) {
      req.log.error("Gmail accepted the email but returned no thread ID");
      res.status(502).json({
        error: "Email was sent, but its reply could not be tracked.",
      });
      return;
    }
    const [entry] = await db
      .insert(purchaseEntriesTable)
      .values({
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        itemName,
        price,
        orderNumber,
        recipient,
        gmailThreadId,
        status: "Sent",
      })
      .returning({ id: purchaseEntriesTable.id });

    res.json(
      SendPurchasePriceEmailResponse.parse({
        sent: true,
        recipient,
        orderNumber,
        purchaseEntryId: entry.id,
      }),
    );
  } catch (error) {
    req.log.error(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Purchase price email delivery status is uncertain",
    );
    res.status(502).json({
      error: "Email delivery status is uncertain. Check Gmail Sent before retrying.",
    });
  }
});

router.get("/purchase-entry/:purchaseEntryId/status", async (req, res): Promise<void> => {
  const parsed = GetPurchaseEntryStatusParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [entry] = await db
    .select({
      status: purchaseEntriesTable.status,
      orderNumber: purchaseEntriesTable.orderNumber,
    })
    .from(purchaseEntriesTable)
    .where(eq(purchaseEntriesTable.id, parsed.data.purchaseEntryId))
    .limit(1);
  if (!entry) {
    res.status(404).json({ error: "Purchase entry not found." });
    return;
  }
  res.json(GetPurchaseEntryStatusResponse.parse({ status: entry.status, orderNumber: entry.orderNumber }));
});

export default router;
