import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";

const sendRequestBody = z.object({
  receiverUsername: z.string().min(3),
});

const respondBody = z.object({
  action: z.enum(["accept", "decline"]),
});

const favBody = z.object({
  friendUsername: z.string().min(3),
});

async function findUserIdByUsername(
  app: FastifyInstance,
  username: string,
): Promise<{ id: string; username: string } | null> {
  const { data } = await app.supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();
  return data ? { id: data.id as string, username: data.username as string } : null;
}

export async function friendRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const user = await app.requireAuth(req);
    const { data, error } = await app.supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status, sent_at, responded_at")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq("status", "accepted");
    if (error) throw new HttpError(500, error.message);

    const ids = new Set<string>();
    for (const r of data ?? []) {
      const otherId = (r.sender_id as string) === user.id ? (r.receiver_id as string) : (r.sender_id as string);
      ids.add(otherId);
    }
    if (ids.size === 0) return [];

    const { data: profiles } = await app.supabase
      .from("profiles")
      .select("id, username, email")
      .in("id", Array.from(ids));
    return profiles ?? [];
  });

  app.get("/requests", async (req) => {
    const user = await app.requireAuth(req);
    const { data: incoming } = await app.supabase
      .from("friend_requests")
      .select("id, sender_id, status, sent_at")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("sent_at", { ascending: false });

    const ids = (incoming ?? []).map((r) => r.sender_id as string);
    let senderMap: Record<string, { username: string | null; email: string }> = {};
    if (ids.length > 0) {
      const { data: senders } = await app.supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", ids);
      senderMap = Object.fromEntries(
        (senders ?? []).map((s) => [s.id as string, { username: s.username as string | null, email: s.email as string }]),
      );
    }

    return (incoming ?? []).map((r) => ({
      id: r.id,
      sentAt: r.sent_at,
      sender: senderMap[r.sender_id as string] ?? { username: null, email: "" },
    }));
  });

  app.post("/requests", async (req) => {
    const user = await app.requireAuth(req);
    const parse = sendRequestBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    if (user.username === parse.data.receiverUsername) {
      throw new HttpError(400, "Cannot send a request to yourself");
    }

    const target = await findUserIdByUsername(app, parse.data.receiverUsername);
    if (!target) throw new HttpError(404, "User not found");

    const { data: existing } = await app.supabase
      .from("friend_requests")
      .select("id, status")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${user.id})`,
      )
      .maybeSingle();
    if (existing) throw new HttpError(409, `Already exists (status: ${existing.status})`);

    const { data, error } = await app.supabase
      .from("friend_requests")
      .insert({ sender_id: user.id, receiver_id: target.id, status: "pending" })
      .select("id, status, sent_at")
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  });

  app.post("/requests/:id/respond", async (req) => {
    const user = await app.requireAuth(req);
    const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid id");
    const parse = respondBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const { data: row } = await app.supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status")
      .eq("id", params.data.id)
      .maybeSingle();
    if (!row) throw new HttpError(404, "Request not found");
    if (row.receiver_id !== user.id) throw new HttpError(403, "Only receiver can respond");
    if (row.status !== "pending") throw new HttpError(409, "Already responded");

    const newStatus = parse.data.action === "accept" ? "accepted" : "declined";
    const { error } = await app.supabase
      .from("friend_requests")
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq("id", params.data.id);
    if (error) throw new HttpError(500, error.message);
    return { ok: true, status: newStatus };
  });

  app.delete("/:friendId", async (req) => {
    const user = await app.requireAuth(req);
    const params = z.object({ friendId: z.string().uuid() }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid id");
    const { error } = await app.supabase
      .from("friend_requests")
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${params.data.friendId}),and(sender_id.eq.${params.data.friendId},receiver_id.eq.${user.id})`,
      );
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  });

  app.get("/favorites", async (req) => {
    const user = await app.requireAuth(req);
    const { data: favs, error } = await app.supabase
      .from("favorites")
      .select("id, friend_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);

    const ids = (favs ?? []).map((f) => f.friend_id as string);
    if (ids.length === 0) return [];
    const { data: profiles } = await app.supabase
      .from("profiles")
      .select("id, username, email")
      .in("id", ids);
    const profMap = Object.fromEntries(
      (profiles ?? []).map((p) => [
        p.id as string,
        { username: p.username as string | null, email: p.email as string },
      ]),
    );
    return (favs ?? []).map((f) => ({
      id: f.id,
      friend: profMap[f.friend_id as string] ?? { username: null, email: "" },
    }));
  });

  app.post("/favorites", async (req) => {
    const user = await app.requireAuth(req);
    const parse = favBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const target = await findUserIdByUsername(app, parse.data.friendUsername);
    if (!target) throw new HttpError(404, "User not found");
    if (target.id === user.id) throw new HttpError(400, "Cannot favorite yourself");

    const { data, error } = await app.supabase
      .from("favorites")
      .insert({ user_id: user.id, friend_id: target.id })
      .select("id, friend_id, created_at")
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  });

  app.delete("/favorites/:id", async (req) => {
    const user = await app.requireAuth(req);
    const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid id");
    const { error } = await app.supabase
      .from("favorites")
      .delete()
      .eq("id", params.data.id)
      .eq("user_id", user.id);
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  });
}
