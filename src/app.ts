import "dotenv/config";
import express from "express";
import { knex } from "./db/knex";
import { makeRepos } from "./db/repos";
import { makeItemsRoutes } from "./routes/itemsRoutes";
import { makeOrdersRoutes } from "./routes/ordersRoutes";
import { makeAdminFulfillmentRoutes } from "./routes/admin/fulfillmentRoutes";
import { makeAdminItemsRoutes } from "./routes/admin/itemsRoutes";
import cors from "cors";

export function makeApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const repos = makeRepos(knex);

  app.get("/api/health", async (_req, res) => {
    await knex.raw("select 1 as ok");
    res.json({ ok: true });
  });

  app.use("/api/items", makeItemsRoutes(repos));
  app.use("/api/orders", makeOrdersRoutes(repos));
  app.use("/api/admin/fulfillment", makeAdminFulfillmentRoutes(repos));
  app.use("/api/admin/items", makeAdminItemsRoutes(repos));
  
  return app;
}
