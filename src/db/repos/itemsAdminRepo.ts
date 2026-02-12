import type { Knex } from "knex";

export type CreateItemInput = {
  title: string;
  description?: string | null;
  priceCents: number;
  currency?: string;
  quantityAvailable?: number;
  makeTimeMinutes?: number | null;
  isActive?: boolean;
};

export type UpdateItemInput = {
  title?: string;
  description?: string | null;
  priceCents?: number;
  currency?: string;
  quantityAvailable?: number;
  makeTimeMinutes?: number | null;
  isActive?: boolean;
};

export type CreateImageInput = {
  itemId: number;
  url: string;
  sortOrder?: number | null;
  altText?: string | null;
};

export type UpdateImageInput = {
  url?: string;
  sortOrder?: number | null;
  altText?: string | null;
};

type ItemRow = {
  id: string | number;
  title: string;
  description: string | null;
  price_cents: string | number;
  currency: string;
  quantity_available: string | number;
  make_time_minutes: string | number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ItemImageRow = {
  id: string | number;
  item_id: string | number;
  url: string;
  sort_order: string | number | null;
  alt_text: string | null;
};

export type AdminItem = {
  id: number;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  quantityAvailable: number;
  makeTimeMinutes: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminItemImage = {
  id: number;
  itemId: number;
  url: string;
  sortOrder: number | null;
  altText: string | null;
};

function mapItem(r: ItemRow): AdminItem {
  return {
    id: Number(r.id),
    title: r.title,
    description: r.description,
    priceCents: Number(r.price_cents),
    currency: r.currency,
    quantityAvailable: Number(r.quantity_available),
    makeTimeMinutes: r.make_time_minutes == null ? null : Number(r.make_time_minutes),
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapImage(r: ItemImageRow): AdminItemImage {
  return {
    id: Number(r.id),
    itemId: Number(r.item_id),
    url: r.url,
    sortOrder: r.sort_order == null ? null : Number(r.sort_order),
    altText: r.alt_text,
  };
}

export function makeItemsAdminRepo(knex: Knex) {
  async function listItems(): Promise<AdminItem[]> {
    const rows = await knex<ItemRow>("items").select("*").orderBy("id", "asc");
    return rows.map(mapItem);
  }

  async function getItem(id: number): Promise<AdminItem | null> {
    const row = await knex<ItemRow>("items").where({ id }).first();
    return row ? mapItem(row) : null;
  }

  async function createItem(input: CreateItemInput): Promise<AdminItem> {
    if (!input.title || typeof input.title !== "string") throw new Error("title is required");
    if (!Number.isInteger(input.priceCents) || input.priceCents < 0) throw new Error("priceCents must be >= 0");

    const currency = input.currency ?? "USD";
    const quantityAvailable = input.quantityAvailable ?? 0;
    const isActive = input.isActive ?? true;

    if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
      throw new Error("quantityAvailable must be >= 0");
    }

    const [row] = await knex<ItemRow>("items")
      .insert({
        title: input.title,
        description: input.description ?? null,
        price_cents: input.priceCents,
        currency,
        quantity_available: quantityAvailable,
        make_time_minutes: input.makeTimeMinutes ?? null,
        is_active: isActive,
      })
      .returning("*");

    return mapItem(row);
  }

  async function updateItem(id: number, patch: UpdateItemInput): Promise<AdminItem> {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id");

    const update: any = {};
    if (patch.title !== undefined) {
      if (!patch.title || typeof patch.title !== "string") throw new Error("title must be a non-empty string");
      update.title = patch.title;
    }
    if (patch.description !== undefined) update.description = patch.description ?? null;

    if (patch.priceCents !== undefined) {
      if (!Number.isInteger(patch.priceCents) || patch.priceCents < 0) throw new Error("priceCents must be >= 0");
      update.price_cents = patch.priceCents;
    }
    if (patch.currency !== undefined) {
      if (typeof patch.currency !== "string" || patch.currency.length < 3) throw new Error("currency must be a string");
      update.currency = patch.currency;
    }
    if (patch.quantityAvailable !== undefined) {
      if (!Number.isInteger(patch.quantityAvailable) || patch.quantityAvailable < 0)
        throw new Error("quantityAvailable must be >= 0");
      update.quantity_available = patch.quantityAvailable;
    }
    if (patch.makeTimeMinutes !== undefined) update.make_time_minutes = patch.makeTimeMinutes ?? null;
    if (patch.isActive !== undefined) update.is_active = Boolean(patch.isActive);

    // Always bump updated_at (your migration defaults it but doesn’t auto-update)
    update.updated_at = knex.fn.now();

    const [row] = await knex<ItemRow>("items").where({ id }).update(update).returning("*");
    if (!row) throw new Error("Item not found");
    return mapItem(row);
  }

  async function deleteItem(id: number): Promise<void> {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id");

    // item_images has ON DELETE CASCADE; order_line_items uses SET NULL;
    // fulfillment_units references items with RESTRICT in your migration.
    // So: if an item has fulfillment_units, deletion will fail — that’s good.
    const deleted = await knex("items").where({ id }).del();
    if (deleted !== 1) throw new Error("Item not found");
  }

  // ---------- Images ----------

  async function listImages(itemId: number): Promise<AdminItemImage[]> {
    const rows = await knex<ItemImageRow>("item_images")
      .where({ item_id: itemId })
      .orderBy([{ column: "sort_order", order: "asc" }, { column: "id", order: "asc" }]);

    return rows.map(mapImage);
  }

  async function addImage(input: CreateImageInput): Promise<AdminItemImage> {
    if (!Number.isInteger(input.itemId) || input.itemId <= 0) throw new Error("Invalid itemId");
    if (!input.url || typeof input.url !== "string") throw new Error("url is required");

    const [row] = await knex<ItemImageRow>("item_images")
      .insert({
        item_id: input.itemId,
        url: input.url,
        sort_order: input.sortOrder ?? null,
        alt_text: input.altText ?? null,
      })
      .returning("*");

    return mapImage(row);
  }

  async function updateImage(imageId: number, patch: UpdateImageInput): Promise<AdminItemImage> {
    if (!Number.isInteger(imageId) || imageId <= 0) throw new Error("Invalid imageId");

    const update: any = {};
    if (patch.url !== undefined) {
      if (!patch.url || typeof patch.url !== "string") throw new Error("url must be a non-empty string");
      update.url = patch.url;
    }
    if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder ?? null;
    if (patch.altText !== undefined) update.alt_text = patch.altText ?? null;

    const [row] = await knex<ItemImageRow>("item_images").where({ id: imageId }).update(update).returning("*");
    if (!row) throw new Error("Image not found");
    return mapImage(row);
  }

  async function deleteImage(imageId: number): Promise<void> {
    if (!Number.isInteger(imageId) || imageId <= 0) throw new Error("Invalid imageId");
    const deleted = await knex("item_images").where({ id: imageId }).del();
    if (deleted !== 1) throw new Error("Image not found");
  }

  return {
    listItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,

    listImages,
    addImage,
    updateImage,
    deleteImage,
  };
}

export type ItemsAdminRepo = ReturnType<typeof makeItemsAdminRepo>;
