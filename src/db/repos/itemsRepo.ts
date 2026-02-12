import type { Knex } from "knex";

export type ItemImage = {
  id: number;
  itemId: number;
  url: string;
  sortOrder: number | null;
  altText: string | null;
};

export type Item = {
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
  images: ItemImage[];
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

function mapItem(row: ItemRow, images: ItemImageRow[]): Item {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    quantityAvailable: Number(row.quantity_available),
    makeTimeMinutes: row.make_time_minutes == null ? null : Number(row.make_time_minutes),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: images
      .sort((a, b) => Number(a.sort_order ?? 999999) - Number(b.sort_order ?? 999999))
      .map((img) => ({
        id: Number(img.id),
        itemId: Number(img.item_id),
        url: img.url,
        sortOrder: img.sort_order == null ? null : Number(img.sort_order),
        altText: img.alt_text,
      })),
  };
}

export function makeItemsRepo(knex: Knex) {
  async function getActiveItemsWithImages(): Promise<Item[]> {
    const items = await knex<ItemRow>("items")
      .select("*")
      .where({ is_active: true })
      .orderBy("id", "asc");

    const ids = items.map((i) => Number(i.id));
    const images = ids.length
      ? await knex<ItemImageRow>("item_images").select("*").whereIn("item_id", ids)
      : [];

    const imagesByItemId = new Map<number, ItemImageRow[]>();
    for (const img of images) {
      const key = Number(img.item_id);
      const arr = imagesByItemId.get(key) ?? [];
      arr.push(img);
      imagesByItemId.set(key, arr);
    }

    return items.map((it) => mapItem(it, imagesByItemId.get(Number(it.id)) ?? []));
  }

  async function getItemByIdWithImages(id: number): Promise<Item | null> {
    const item = await knex<ItemRow>("items").select("*").where({ id }).first();
    if (!item) return null;

    const images = await knex<ItemImageRow>("item_images").select("*").where({ item_id: id });
    return mapItem(item, images);
  }

  return { getActiveItemsWithImages, getItemByIdWithImages };
}

export type ItemsRepo = ReturnType<typeof makeItemsRepo>;
