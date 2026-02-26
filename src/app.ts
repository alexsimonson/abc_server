import "dotenv/config";
import express from "express";
import session from "express-session";
import path from "path";
import { knex } from "./db/knex";
import { makeRepos } from "./db/repos";
import { makeAuthRouter } from "./routes/authRoutes";
import { makeRequireAdmin } from "./middleware/auth";
import { makeItemsRoutes } from "./routes/itemsRoutes";
import { makeOrdersRoutes } from "./routes/ordersRoutes";
import { makeAdminFulfillmentRoutes } from "./routes/admin/fulfillmentRoutes";
import { makeAdminItemsRoutes } from "./routes/admin/itemsRoutes";
import cors from "cors";
import { getAllLocalIps } from "./utils/networkUtils";

// CORS configuration for local network development
function getCorsOptions() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  if (!isDevelopment) {
    // Production: be restrictive
    return {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };
  }

  // Development: allow local network and localhost
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) {
        console.log("[CORS] Allowing request with no origin header");
        return callback(null, true);
      }

      console.log(`[CORS] Checking origin: ${origin}`);

      // Allow localhost and 127.0.0.1
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        console.log(`[CORS] ✓ Allowing localhost origin: ${origin}`);
        return callback(null, true);
      }

      // Allow local network (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      try {
        const url = new URL(origin);
        const hostname = url.hostname;
        console.log(`[CORS] Parsed hostname: ${hostname}`);

        // Private IP ranges
        const isPrivate = 
          /^127\./.test(hostname) || // 127.x.x.x
          /^192\.168\./.test(hostname) || // 192.168.x.x
          /^10\./.test(hostname) || // 10.x.x.x
          /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) || // 172.16-31.x.x
          /\.local$/i.test(hostname) || // *.local (mDNS)
          hostname === "localhost" ||
          hostname === "0.0.0.0";

        if (isPrivate) {
          console.log(`[CORS] ✓ Allowing private IP origin: ${origin}`);
          return callback(null, true);
        }
      } catch (e) {
        console.log(`[CORS] URL parsing error: ${e}`);
      }

      // Allow custom API hosts from environment
      if (process.env.ALLOWED_ORIGINS) {
        const allowed = process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
        if (allowed.includes(origin)) {
          console.log(`[CORS] ✓ Allowing custom origin: ${origin}`);
          return callback(null, true);
        }
      }

      // Reject all others in development
      console.warn(`[CORS] ✗ REJECTED origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  };
}

export function makeApp() {
  const app = express();
  app.use(cors(getCorsOptions()));
  app.use(express.json());
  
  // Session middleware for authentication
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // set true behind https
      },
    })
  );
  
  // Serve static files from public directory
  app.use(express.static(path.join(process.cwd(), "public")));

  const repos = makeRepos(knex);

  app.get("/api/health", async (_req, res) => {
    await knex.raw("select 1 as ok");
    res.json({ ok: true });
  });

  // Network diagnostic endpoint
  app.get("/api/network-info", (_req, res) => {
    const serverIps = getAllLocalIps();
    const clientIp = _req.ip || _req.connection.remoteAddress || "unknown";
    const origin = _req.get("origin") || "no origin header";
    
    res.json({
      serverIps: serverIps.map(ip => ({ interface: ip.interface, address: ip.address })),
      clientIp,
      origin,
      apiPort: process.env.PORT || 4001,
      clientPort: 3001,
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", makeAuthRouter(knex));
  app.use("/api/items", makeItemsRoutes(repos));
  app.use("/api/orders", makeOrdersRoutes(repos));
  
  // Admin routes - require authentication
  const requireAdmin = makeRequireAdmin(knex);
  app.use("/api/admin/fulfillment", requireAdmin, makeAdminFulfillmentRoutes(repos));
  app.use("/api/admin/items", requireAdmin, makeAdminItemsRoutes(repos));
  
  return app;
}
