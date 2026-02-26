import { Router } from "express";
import type { Repos } from "../db/repos";
import type { CreateTicketInput } from "../db/repos/ticketsRepo";

export function makeTicketsRoutes(repos: Repos) {
  const router = Router();

  // POST /api/tickets - Create a new support ticket (public)
  router.post("/", async (req, res) => {
    const body = req.body as Partial<CreateTicketInput>;

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid body" });
    }
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (typeof body.subject !== "string" || body.subject.trim().length === 0) {
      return res.status(400).json({ error: "Subject is required" });
    }
    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ticket = await repos.ticketsRepo.createTicket({
      email: body.email.trim(),
      subject: body.subject.trim(),
      message: body.message.trim(),
    });

    res.status(201).json(ticket);
  });

  return router;
}
