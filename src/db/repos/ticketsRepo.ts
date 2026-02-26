import type { Knex } from "knex";

export type TicketStatusCode = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type SupportTicket = {
  id: number;
  email: string;
  subject: string;
  message: string;
  statusCode: TicketStatusCode;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTicketInput = {
  email: string;
  subject: string;
  message: string;
};

export type UpdateTicketInput = {
  statusCode?: TicketStatusCode;
  adminNotes?: string;
};

type TicketRow = {
  id: number;
  email: string;
  subject: string;
  message: string;
  status_code: TicketStatusCode;
  admin_notes: string | null;
  created_at: Date;
  updated_at: Date;
};

function rowToTicket(row: TicketRow): SupportTicket {
  return {
    id: row.id,
    email: row.email,
    subject: row.subject,
    message: row.message,
    statusCode: row.status_code,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function makeTicketsRepo(knex: Knex) {
  async function createTicket(input: CreateTicketInput): Promise<SupportTicket> {
    const [row] = await knex<TicketRow>("support_tickets")
      .insert({
        email: input.email,
        subject: input.subject,
        message: input.message,
        status_code: "NEW",
      })
      .returning("*");

    return rowToTicket(row);
  }

  async function getAllTickets(): Promise<SupportTicket[]> {
    const rows = await knex<TicketRow>("support_tickets")
      .select("*")
      .orderBy("created_at", "desc");

    return rows.map(rowToTicket);
  }

  async function getTicketById(id: number): Promise<SupportTicket | null> {
    const row = await knex<TicketRow>("support_tickets")
      .where({ id })
      .first();

    return row ? rowToTicket(row) : null;
  }

  async function updateTicket(id: number, input: UpdateTicketInput): Promise<SupportTicket | null> {
    const updates: Partial<TicketRow> = {
      updated_at: knex.fn.now() as any,
    };

    if (input.statusCode !== undefined) {
      updates.status_code = input.statusCode;
    }
    if (input.adminNotes !== undefined) {
      updates.admin_notes = input.adminNotes;
    }

    const [row] = await knex<TicketRow>("support_tickets")
      .where({ id })
      .update(updates)
      .returning("*");

    return row ? rowToTicket(row) : null;
  }

  return {
    createTicket,
    getAllTickets,
    getTicketById,
    updateTicket,
  };
}

export type TicketsRepo = ReturnType<typeof makeTicketsRepo>;
