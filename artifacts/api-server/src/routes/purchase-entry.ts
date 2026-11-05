import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  SendPurchasePriceEmailBody,
  SendPurchasePriceEmailResponse,
} from "@workspace/api-zod";
import { db, suppliersTable } from "@workspace/db";

const router: IRouter = Router();
const connectors = new ReplitConnectors();
const recipient = "shreckengost@gmail.com";
const sendWindowMs = 60_000;
const maxSendsPerWindow = 5;
const sendWindows = new Map<string, { count: number; expiresAt: number }>();

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
      paymentTerms: suppliersTable.paymentTerms,
    })
    .from(suppliersTable)
    .where(eq(suppliersTable.supplierId, parsed.data.supplierId))
    .limit(1);

  if (!supplier) {
    res.status(404).json({ error: "Supplier not found." });
    return;
  }

  const sendAttempt = reserveSendAttempt(req.ip || "unknown");
  if (!sendAttempt.allowed) {
    res.setHeader("Retry-After", String(sendAttempt.retryAfterSeconds));
    res.status(429).json({ error: "Email send limit reached. Wait before trying again." });
    return;
  }

  const itemName = parsed.data.itemName.trim().replace(/[\r\n]+/g, " ");
  const price = Number(parsed.data.price).toFixed(2);
  const emailBody = [
    "Capture a price",
    "",
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
    "Subject: Capture a price",
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

    res.json(SendPurchasePriceEmailResponse.parse({ sent: true, recipient }));
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

export default router;
