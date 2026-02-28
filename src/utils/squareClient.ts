const { Client, Environment } = require("square/legacy");

/**
 * Initialize Square client with credentials from environment variables.
 * Uses PRODUCTION environment for real transactions, SANDBOX for testing.
 */
export function initializeSquareClient() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const squareEnv = process.env.SQUARE_ENV || "production";

  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN is not set in environment variables");
  }

  if (!locationId) {
    throw new Error("SQUARE_LOCATION_ID is not set in environment variables");
  }

  const environment = squareEnv === "sandbox" ? Environment.Sandbox : Environment.Production;

  const client = new Client({
    accessToken,
    environment,
    userAgentDetail: "abc_site_checkout",
  });

  return { client, locationId, environment };
}

/**
 * Get Square payments API client
 */
export function getSquarePaymentsApi() {
  const { client } = initializeSquareClient();
  return client.paymentsApi;
}

/**
 * Get Square orders API client
 */
export function getSquareOrdersApi() {
  const { client } = initializeSquareClient();
  return client.ordersApi;
}

/**
 * Process a payment with Square
 */
export async function processSquarePayment(options: {
  sourceId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  orderReference?: string;
}) {
  const paymentsApi = getSquarePaymentsApi();

  try {
    const response = await paymentsApi.createPayment({
      sourceId: options.sourceId,
      amountMoney: {
        amount: options.amountCents,
        currency: options.currency,
      },
      idempotencyKey: options.idempotencyKey,
      note: options.orderReference ? `Order #${options.orderReference}` : undefined,
      autocomplete: true,
    });

    const payment = response?.result?.payment;
    if (!payment) {
      throw new Error("Square payment response missing payment object");
    }

    return payment;
  } catch (error) {
    console.error("Square payment error:", error);
    throw error;
  }
}
