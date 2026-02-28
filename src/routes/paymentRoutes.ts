import { Router } from "express";
import { randomUUID } from "crypto";
import { processSquarePayment, initializeSquareClient } from "../utils/squareClient";
import type { Repos } from "../db/repos";

interface PaymentRequest {
  email: string;
  shippingAddress: Record<string, unknown> | null;
  items: Array<{ itemId: number; quantity: number }>;
  taxCents: number;
  shippingCents: number;
  currency: string;
  sourceId: string; // From Square Web Payments SDK
}

export function makePaymentRoutes(repos: Repos) {
  const router = Router();

  // POST /api/payment/process
  // Process a payment with Square and create an order
  router.post("/process", async (req, res) => {
    try {
      const body = req.body as Partial<PaymentRequest>;

      // Validation
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Invalid request body" });
      }

      if (typeof body.email !== "string" || !body.email.trim()) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      if (!Array.isArray(body.items) || body.items.length === 0) {
        return res.status(400).json({ error: "items must be a non-empty array" });
      }

      if (typeof body.sourceId !== "string" || !body.sourceId.trim()) {
        return res.status(400).json({ error: "Valid sourceId is required" });
      }

      const taxCents = body.taxCents ?? 0;
      const shippingCents = body.shippingCents ?? 0;
      const currency = body.currency ?? "USD";

      // Calculate total amount by fetching item prices
      // which also validates items exist
      const allItems = await repos.itemsRepo.getActiveItemsWithImages();
      let subtotalCents = 0;

      for (const cartItem of body.items) {
        const item = allItems.find((i) => i.id === cartItem.itemId);
        if (!item) {
          return res.status(400).json({ error: `Item with id ${cartItem.itemId} not found or is inactive` });
        }
        subtotalCents += item.priceCents * cartItem.quantity;
      }

      const totalCents = subtotalCents + taxCents + shippingCents;

      // Generate idempotency key for Square (ensures idempotent payment processing)
      const idempotencyKey = randomUUID();
      const { locationId } = initializeSquareClient();

      // Process payment with Square
      let paymentResult;
      try {
        paymentResult = await processSquarePayment({
          sourceId: body.sourceId,
          amountCents: totalCents,
          currency,
          idempotencyKey,
          orderReference: `order_${Date.now()}`,
        });
      } catch (error: any) {
        console.error("Square payment failed:", error);
        const errorMessage = error?.errors?.[0]?.detail ?? error?.message ?? "Payment processing failed";
        return res.status(402).json({ error: errorMessage });
      }

      // If payment was successful, create order in database
      if (!paymentResult?.id) {
        return res.status(500).json({ error: "Payment succeeded but no payment ID returned" });
      }

      try {
        const orderResult = await repos.ordersRepo.createOrderWithFulfillmentUnits({
          email: body.email.trim(),
          shippingAddress: body.shippingAddress ?? null,
          items: body.items,
          taxCents,
          shippingCents,
          currency,
        });

        // Return success with order and payment details
        return res.status(201).json({
          success: true,
          order: orderResult,
          payment: {
            id: paymentResult.id,
            status: paymentResult.status,
            receiptUrl: paymentResult.receiptUrl,
          },
        });
      } catch (orderError: any) {
        console.error("Order creation failed after successful payment:", orderError);
        // Note: In a production system, you might want to handle this more carefully
        // (e.g., store the payment separately and retry order creation)
        return res.status(500).json({
          error: "Payment succeeded but order creation failed. Please contact support.",
          paymentId: paymentResult.id,
        });
      }
    } catch (error: any) {
      console.error("Payment endpoint error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
