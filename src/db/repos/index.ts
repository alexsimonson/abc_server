import type { Knex } from "knex";
import { makeItemsRepo } from "./itemsRepo";
import { makeOrdersRepo } from "./ordersRepo";
import { makeFulfillmentRepo } from "./fulfillmentRepo";
import { makeItemsAdminRepo } from "./itemsAdminRepo";

export function makeRepos(knex: Knex) {
  return {
    itemsRepo: makeItemsRepo(knex),
    ordersRepo: makeOrdersRepo(knex),
    fulfillmentRepo: makeFulfillmentRepo(knex),
    itemsAdminRepo: makeItemsAdminRepo(knex),
  };
}

export type Repos = ReturnType<typeof makeRepos>;
