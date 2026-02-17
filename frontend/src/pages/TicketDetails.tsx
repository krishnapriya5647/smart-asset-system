// frontend/src/pages/TicketDetails.tsx

import { useMemo } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

type Me = { id: number; username: string; role: "ADMIN" | "EMPLOYEE" };

type User = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  role?: "ADMIN" | "EMPLOYEE";
};

type Asset = {
  id: number;
  name: string;
  serial_number: string;
  status: string;
  type?: string;
};

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

type Ticket = {
  id: number;
  asset: number;
  issue: string;
  status: TicketStatus;
  assigned_technician: number | null;
  created_at: string;
  created_by: number;

  resolution_note?: string;
  resolved_at?: string | null;
  resolved_by?: number | null;

  asset_detail?: Asset;
  created_by_detail?: User;
  assigned_technician_detail?: User;
  resolved_by_detail?: User;
};

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const results = obj["results"];
    if (Array.isArray(results)) return results as T[];
  }
  return [];
}

function formatUser(u: User) {
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full ? `${full} (@${u.username})` : `@${u.username}`;
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return "";

  const diffSec = Math.round((ms - Date.now()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let duration = diffSec;
  for (let i = 0; i < divisions.length; i++) {
    const [amount, unit] = divisions[i];
    if (Math.abs(duration) < amount) return rtf.format(duration, unit);
    duration = Math.round(duration / amount);
  }
  return "";
}

export default function TicketDetails() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();
  const ticketId = Number(id);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = me?.role === "ADMIN";

  const { data: users } = useQuery({
    queryKey: ["users"],
    enabled: !!isAdmin,
    queryFn: async () => unwrapList<User>((await api.get("/api/users/")).data),
  });

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ["ticket", ticketId],
    enabled: Number.isFinite(ticketId) && ticketId > 0,
    queryFn: async () => (await api.get<Ticket>(`/api/tickets/${ticketId}/`)).data,
  });

  const neededUserIds = useMemo(() => {
    const set = new Set<number>();
    if (ticket?.created_by) set.add(ticket.created_by);
    if (ticket?.assigned_technician) set.add(ticket.assigned_technician);
    if (ticket?.resolved_by) set.add(ticket.resolved_by);

    if (ticket?.created_by_detail?.id) set.add(ticket.created_by_detail.id);
    if (ticket?.assigned_technician_detail?.id) set.add(ticket.assigned_technician_detail.id);
    if (ticket?.resolved_by_detail?.id) set.add(ticket.resolved_by_detail.id);

    (users ?? []).forEach((u) => set.delete(u.id));
    return Array.from(set);
  }, [ticket, users]);

  const { data: userMap } = useQuery({
    queryKey: ["users_by_id_details_page", neededUserIds],
    enabled: neededUserIds.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        neededUserIds.map(async (uid) => {
          try {
            const u = (await api.get<User>(`/api/users/${uid}/`)).data;
            return [uid, u] as const;
          } catch {
            return [uid, null] as const;
          }
        })
      );

      const map: Record<number, User> = {};
      for (const [uid, u] of pairs) {
        if (u) map[uid] = u;
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const userLabel = (userId: number | null | undefined, detail?: User | null) => {
    if (userId == null) return "—";
    if (detail?.id === userId) return formatUser(detail);

    const u1 = (users ?? []).find((x) => x.id === userId);
    if (u1) return formatUser(u1);

    const u2 = userMap?.[userId];
    if (u2) return formatUser(u2);

    if (me?.id === userId) return `${me.username} (Me)`;

    return `User ${userId}`;
  };

  const approveCloseMut = useMutation({
    mutationFn: async () => api.post(`/api/tickets/${ticketId}/approve-close/`, {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => api.delete(`/api/tickets/${ticketId}/`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      navigate("/tickets");
    },
  });

  const assetTitle = useMemo(() => {
    if (!ticket) return "";
    if (ticket.asset_detail?.name && ticket.asset_detail?.serial_number) {
      return `${ticket.asset_detail.name} (${ticket.asset_detail.serial_number})`;
    }
    return "Asset";
  }, [ticket]);

  const createdAtText = useMemo(() => {
    const raw = ticket?.created_at;
    if (!raw) return "";
    return raw.slice(0, 19).replace("T", " ");
  }, [ticket?.created_at]);

  const resolvedAtText = useMemo(() => {
    const raw = ticket?.resolved_at ?? "";
    if (!raw) return "";
    return raw.slice(0, 19).replace("T", " ");
  }, [ticket?.resolved_at]);

  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Invalid ticket id
        </Typography>
        <Button component={RouterLink} to="/tickets" variant="outlined">
          Back to Tickets
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
            <RouterLink to="/tickets" style={{ textDecoration: "none" }}>
              Tickets
            </RouterLink>
            {ticket ? (
              <>
                {" "}
                / <span style={{ fontWeight: 600 }}>{assetTitle}</span>
              </>
            ) : (
              <> / Ticket</>
            )}
          </Typography>

          <Typography variant="h5" sx={{ fontWeight: 700 }} noWrap>
            {ticket ? assetTitle : "Ticket Details"}
          </Typography>

          <Typography sx={{ color: "text.secondary", fontSize: 13, mt: 0.5 }}>
            Ticket ID: {ticketId}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate("/tickets")}>
            Back
          </Button>

          {isAdmin ? (
            <>
              <Button
                variant="outlined"
                onClick={() => navigate(`/tickets?edit=${ticketId}`)}
                disabled={!ticket}
              >
                Edit
              </Button>

              <Button
                color="error"
                variant="outlined"
                onClick={() => {
                  if (!ticket) return;
                  const ok = window.confirm("Delete this ticket?");
                  if (ok) deleteMut.mutate();
                }}
                disabled={deleteMut.isPending || !ticket}
              >
                {deleteMut.isPending ? "Deleting..." : "Delete"}
              </Button>
            </>
          ) : null}

          {isAdmin && ticket?.status === "RESOLVED" ? (
            <Button
              variant="contained"
              onClick={() => approveCloseMut.mutate()}
              disabled={approveCloseMut.isPending}
            >
              {approveCloseMut.isPending ? "Closing..." : "Approve & Close"}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {isLoading ? (
        <Typography sx={{ color: "text.secondary" }}>Loading...</Typography>
      ) : isError || !ticket ? (
        <Typography sx={{ color: "error.main" }}>Could not load ticket. (Check permissions or id)</Typography>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }} noWrap>
                  {assetTitle}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Chip size="small" label={ticket.status} />
                  <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                    Created {timeAgo(ticket.created_at)}
                  </Typography>
                  <Typography sx={{ color: "text.secondary", fontSize: 13 }}>({createdAtText})</Typography>
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Issue</Typography>
                <Typography sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}>
                  {ticket.issue || "—"}
                </Typography>

                {ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Technician update</Typography>

                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Resolved by</Typography>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>
                      {userLabel(ticket.resolved_by, ticket.resolved_by_detail)}
                    </Typography>

                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Resolved at</Typography>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>{resolvedAtText || "—"}</Typography>

                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Work note</Typography>
                    <Typography sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}>
                      {ticket.resolution_note?.trim() ? ticket.resolution_note : "—"}
                    </Typography>
                  </>
                ) : null}
              </Box>

              <Box sx={{ width: { xs: "100%", md: 320 } }}>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Details</Typography>

                <Stack spacing={1}>
                  <Box>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Created by</Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {userLabel(ticket.created_by, ticket.created_by_detail)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Technician</Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {userLabel(ticket.assigned_technician, ticket.assigned_technician_detail)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Asset status</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{ticket.asset_detail?.status ?? "—"}</Typography>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
