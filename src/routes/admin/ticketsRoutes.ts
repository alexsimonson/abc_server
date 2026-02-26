import { Router } from "express";
import type { Repos } from "../../db/repos";
import type { UpdateTicketInput } from "../../db/repos/ticketsRepo";

export function makeAdminTicketsRoutes(repos: Repos) {
  const router = Router();

  // GET /api/admin/tickets - List all tickets
  router.get("/", async (req, res) => {
    const tickets = await repos.ticketsRepo.getAllTickets();
    res.json(tickets);
  });

  // GET /api/admin/tickets/:id - Get single ticket
  router.get("/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ticket ID" });
    }

    const ticket = await repos.ticketsRepo.getTicketById(id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  });

  // PATCH /api/admin/tickets/:id - Update ticket
  router.patch("/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ticket ID" });
    }

    const body = req.body as Partial<UpdateTicketInput>;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid body" });
    }

    const ticket = await repos.ticketsRepo.updateTicket(id, body);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  });

  return router;
}
