// frontend/src/pages/Tickets.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridRowParams,
  useGridApiRef,
} from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

type Me = { id: number; username: string; role: "ADMIN" | "EMPLOYEE" };

type User = {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: "ADMIN" | "EMPLOYEE";
};

type Asset = { id: number; name: string; serial_number: string; status: string };

type Assignment = {
  id: number;
  asset: number;
  employee: number;
  date_assigned: string;
  date_returned: string | null;
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

  resolution_note?: unknown;
  resolved_at?: string | null;
  resolved_by?: number | null;

  asset_detail?: { id: number; name: string; serial_number: string; status: string };
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

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

type Scope =
  | "ALL"
  | "CREATED_BY_ME"
  | "ASSIGNED_TO_ME"
  | "MY_CURRENT_ASSETS"
  | "MY_ASSET_HISTORY";

function formatIso(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 19).replace("T", " ");
}

function formatUser(u: User) {
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full ? `${full} (@${u.username})` : `@${u.username}`;
}

function toText(v: unknown) {
  if (typeof v === "string") return v;
  if (v == null) return "";
  try {
    return String(v);
  } catch {
    return "";
  }
}

function normalizeNote(v: unknown) {
  const stripPrefix = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^(resolution\s*note|note)\s*:\s*/i, "");

  if (v == null) return "";

  if (typeof v === "string") return stripPrefix(v);

  if (Array.isArray(v)) {
    const joined = v.map((x) => toText(x)).filter(Boolean).join(" ");
    return stripPrefix(joined);
  }

  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const candidates = [
      obj.note,
      obj.resolution_note,
      obj.message,
      obj.text,
      obj.value,
      obj.content,
      obj.details,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return stripPrefix(c);
    }

    try {
      return stripPrefix(JSON.stringify(obj));
    } catch {
      return "";
    }
  }

  return stripPrefix(toText(v));
}

function previewText(input: string, max = 48) {
  const s = (input ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function Tickets() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const apiRef = useGridApiRef();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const focusId = useMemo(() => {
    const v = searchParams.get("focus");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const employeeParam = useMemo(() => {
    const v = searchParams.get("employee");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const editId = useMemo(() => {
    const v = searchParams.get("edit");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = me?.role === "ADMIN";

  const { data: assets } = useQuery({
    queryKey: ["assets_dropdown"],
    queryFn: async () => unwrapList<Asset>((await api.get("/api/assets/")).data),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    enabled: !!isAdmin,
    queryFn: async () => unwrapList<User>((await api.get("/api/users/")).data),
  });

  const { data: assignments } = useQuery({
    queryKey: ["assignments_for_ticket_scope"],
    enabled: !!me && !isAdmin,
    queryFn: async () => unwrapList<Assignment>((await api.get("/api/assignments/")).data),
  });

  const currentAssetIds = useMemo(() => {
    if (!me || isAdmin) return new Set<number>();
    const list = (assignments ?? [])
      .filter((a) => a.date_returned === null)
      .map((a) => a.asset);
    return new Set<number>(list);
  }, [assignments, isAdmin, me]);

  const ticketAssetLabel = useMemo(() => {
    return (row: Ticket) => {
      if (row.asset_detail?.name && row.asset_detail?.serial_number) {
        return `${row.asset_detail.name} (${row.asset_detail.serial_number})`;
      }
      const a = (assets ?? []).find((x) => x.id === row.asset);
      return a ? `${a.name} (${a.serial_number})` : `Asset #${row.asset}`;
    };
  }, [assets]);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);

  const [form, setForm] = useState({
    asset: "" as string,
    issue: "",
    status: "OPEN" as TicketStatus,
    assigned_technician: "" as string,
  });

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [scope, setScope] = useState<Scope>("ALL");
  const [search, setSearch] = useState("");

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const ticketsUrl = useMemo(() => {
    if (isAdmin && employeeParam) return `/api/tickets/?employee=${employeeParam}`;
    if (isAdmin) return "/api/tickets/";
    if (scope === "MY_ASSET_HISTORY") return "/api/tickets/?history=1";
    return "/api/tickets/";
  }, [isAdmin, employeeParam, scope]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", ticketsUrl],
    queryFn: async () => unwrapList<Ticket>((await api.get(ticketsUrl)).data),
  });

  const neededUserIds = useMemo(() => {
    const set = new Set<number>();
    (tickets ?? []).forEach((t) => {
      if (t.created_by) set.add(t.created_by);
      if (t.assigned_technician) set.add(t.assigned_technician);
      if (t.resolved_by) set.add(t.resolved_by);
      if (t.created_by_detail?.id) set.add(t.created_by_detail.id);
      if (t.assigned_technician_detail?.id) set.add(t.assigned_technician_detail.id);
      if (t.resolved_by_detail?.id) set.add(t.resolved_by_detail.id);
    });

    (users ?? []).forEach((u) => set.delete(u.id));
    return Array.from(set);
  }, [tickets, users]);

  const { data: userMap } = useQuery({
    queryKey: ["users_by_id", neededUserIds],
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

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        asset: Number(form.asset),
        issue: form.issue,
        status: form.status,
        assigned_technician: form.assigned_technician ? Number(form.assigned_technician) : null,
      };
      return api.post("/api/tickets/", payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      closeForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload = {
        asset: Number(form.asset),
        issue: form.issue,
        status: form.status,
        assigned_technician: form.assigned_technician ? Number(form.assigned_technician) : null,
      };
      return api.patch(`/api/tickets/${editing.id}/`, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      closeForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/tickets/${id}/`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  // Mark done dialog state (technician)
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneTicket, setDoneTicket] = useState<Ticket | null>(null);
  const [doneNote, setDoneNote] = useState("");

  const openDone = (row: Ticket) => {
    setDoneTicket(row);
    setDoneNote("");
    setDoneOpen(true);
  };

  const closeDone = () => {
    setDoneOpen(false);
    setDoneTicket(null);
    setDoneNote("");
  };

  const markDoneMut = useMutation({
    mutationFn: async () => {
      if (!doneTicket) return;
      return api.post(`/api/tickets/${doneTicket.id}/mark-done/`, { note: doneNote.trim() });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      closeDone();
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ asset: "", issue: "", status: "OPEN", assigned_technician: "" });
    setOpenForm(true);
  }

  function openEdit(row: Ticket) {
    setEditing(row);
    setForm({
      asset: String(row.asset),
      issue: row.issue,
      status: row.status,
      assigned_technician: row.assigned_technician ? String(row.assigned_technician) : "",
    });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditing(null);
  }

  const onSave = () => {
    if (!form.asset || !form.issue.trim()) return;
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  // Auto-open edit dialog when URL has ?edit=ID (ADMIN only)
  useEffect(() => {
    if (!isAdmin) return;
    if (!editId) return;
    if (!tickets || tickets.length === 0) return;

    const row = tickets.find((t) => t.id === editId);
    if (!row) return;

    const t = window.setTimeout(() => {
      openEdit(row);
    }, 0);

    const params = new URLSearchParams(searchParams);
    params.delete("edit");
    navigate(
      { pathname: "/tickets", search: params.toString() ? `?${params.toString()}` : "" },
      { replace: true }
    );

    return () => window.clearTimeout(t);
  }, [isAdmin, editId, tickets, searchParams, navigate]);

  // IMPORTANT: not useMemo (fixes react-hooks/preserve-manual-memoization error)
  const filteredRows = (tickets ?? []).filter((t) => {
    const meId = me?.id ?? null;
    const s = search.trim().toLowerCase();

    if (statusFilter && t.status !== statusFilter) return false;

    if (!isAdmin && meId) {
      if (scope === "CREATED_BY_ME" && t.created_by !== meId) return false;
      if (scope === "ASSIGNED_TO_ME" && t.assigned_technician !== meId) return false;
      if (scope === "MY_CURRENT_ASSETS" && !currentAssetIds.has(t.asset)) return false;
    }

    if (s) {
      const assetText = ticketAssetLabel(t).toLowerCase();
      const techText = userLabel(t.assigned_technician, t.assigned_technician_detail).toLowerCase();
      const creatorText = userLabel(t.created_by, t.created_by_detail).toLowerCase();
      const resolvedByText = userLabel(t.resolved_by ?? null, t.resolved_by_detail ?? null).toLowerCase();
      const issueText = (t.issue ?? "").toLowerCase();
      const createdText = formatIso(t.created_at).toLowerCase();
      const noteText = normalizeNote(t.resolution_note).toLowerCase();

      if (
        !assetText.includes(s) &&
        !techText.includes(s) &&
        !creatorText.includes(s) &&
        !resolvedByText.includes(s) &&
        !issueText.includes(s) &&
        !createdText.includes(s) &&
        !noteText.includes(s)
      ) {
        return false;
      }
    }

    return true;
  });

  // Focus highlight logic
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const pendingFocusRef = useRef<{ id: number; targetPage: number; rowIndexWithinPage: number } | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusId) return;
    if (filteredRows.length === 0) return;

    const idx = filteredRows.findIndex((r) => r.id === focusId);
    if (idx === -1) return;

    const pageSize = paginationModel.pageSize || 10;
    const targetPage = Math.floor(idx / pageSize);
    const rowIndexWithinPage = idx - targetPage * pageSize;

    pendingFocusRef.current = { id: focusId, targetPage, rowIndexWithinPage };

    if (paginationModel.page !== targetPage) {
      window.setTimeout(() => {
        setPaginationModel((p) => (p.page === targetPage ? p : { ...p, page: targetPage }));
      }, 0);
      return;
    }

    window.setTimeout(() => {
      const pending = pendingFocusRef.current;
      if (!pending) return;

      requestAnimationFrame(() => {
        apiRef.current?.scrollToIndexes({ rowIndex: pending.rowIndexWithinPage });
      });

      setHighlightId(pending.id);

      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => setHighlightId(null), 4500);

      pendingFocusRef.current = null;
    }, 0);
  }, [focusId, filteredRows, paginationModel.page, paginationModel.pageSize, apiRef]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setScope("ALL");
    setPaginationModel((p) => ({ ...p, page: 0 }));
    navigate({ pathname: "/tickets", search: "" }, { replace: true });
  };

  const canMarkDone = (row: Ticket) => {
    if (!me || isAdmin) return false;
    if (!row.assigned_technician) return false;
    if (row.assigned_technician !== me.id) return false;
    return row.status !== "RESOLVED" && row.status !== "CLOSED";
  };

  // Reordered columns: Created By -> Technician -> Created -> Resolved By -> Note -> Actions
  const columns: GridColDef<Ticket>[] = [
    { field: "id", headerName: "ID", width: 80 },
    {
      field: "asset",
      headerName: "Asset",
      flex: 1,
      minWidth: 240,
      valueGetter: (_value, row) => ticketAssetLabel(row),
    },
    { field: "status", headerName: "Status", width: 130 },

    ...(isAdmin
      ? ([
          {
            field: "created_by",
            headerName: "Created By",
            width: 230,
            valueGetter: (_value, row) => userLabel(row.created_by, row.created_by_detail),
          },
        ] as GridColDef<Ticket>[])
      : []),

    {
      field: "assigned_technician",
      headerName: "Technician",
      width: 230,
      valueGetter: (_value, row) => userLabel(row.assigned_technician, row.assigned_technician_detail),
    },
    {
      field: "created_at",
      headerName: "Created",
      width: 175,
      valueGetter: (_value, row) => formatIso(row.created_at),
    },

    ...(isAdmin
      ? ([
          {
            field: "resolved_by",
            headerName: "Resolved By",
            width: 230,
            valueGetter: (_value, row) =>
              userLabel(row.resolved_by ?? null, row.resolved_by_detail ?? null),
          },
          {
            field: "resolution_note",
            headerName: "Note",
            width: 320,
            sortable: false,
            renderCell: (params) => {
              const isDone = params.row.status === "RESOLVED" || params.row.status === "CLOSED";
              const cleaned = normalizeNote(params.row.resolution_note);
              const shown = isDone ? previewText(cleaned, 60) : "—";
              const full = isDone ? cleaned.trim() : "";

              return (
                <Box
                  title={full || ""}
                  sx={{
                    width: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: "inherit",
                    color: "inherit",
                  }}
                >
                  {shown}
                </Box>
              );
            },
          },
        ] as GridColDef<Ticket>[])
      : []),

    {
      field: "actions",
      headerName: "Actions",
      width: isAdmin ? 220 : 160,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const row = params.row;

        if (isAdmin) {
          return (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={(event) => {
                  event.stopPropagation();
                  openEdit(row);
                }}
              >
                Edit
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteMut.mutate(row.id);
                }}
                disabled={deleteMut.isPending}
              >
                Delete
              </Button>
            </Stack>
          );
        }

        return (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={(event) => {
                event.stopPropagation();
                openDone(row);
              }}
              disabled={!canMarkDone(row) || markDoneMut.isPending}
            >
              Mark Done
            </Button>
          </Stack>
        );
      },
    } as GridColDef<Ticket>,
  ];

  const columnVisibilityModel = isMobile
    ? {
        created_at: false,
        assigned_technician: false,
        created_by: false,
        resolved_by: false,
        resolution_note: false,
      }
    : undefined;

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={1.25}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Tickets
          </Typography>

          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            Create repair tickets and track status.
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            {isAdmin && employeeParam ? (
              <Chip size="small" label={`Filtered by employee: ${employeeParam}`} sx={{ fontWeight: 600 }} />
            ) : null}
          </Stack>
        </Box>

        <Button variant="contained" onClick={openCreate} sx={{ minWidth: { xs: "100%", sm: 160 } }}>
          Create Ticket
        </Button>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { xs: "stretch", md: "center" } }}
      >
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth={isMobile}
          sx={{ minWidth: { xs: "100%", md: 220 } }}
        />

        <TextField
          size="small"
          select
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          fullWidth={isMobile}
          sx={{ minWidth: { xs: "100%", md: 170 } }}
        >
          <MenuItem value="">All</MenuItem>
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>

        {!isAdmin ? (
          <TextField
            size="small"
            select
            label="Scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as Scope)}
            fullWidth={isMobile}
            sx={{ minWidth: { xs: "100%", md: 240 } }}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="CREATED_BY_ME">Created by me</MenuItem>
            <MenuItem value="ASSIGNED_TO_ME">Assigned to me</MenuItem>
            <MenuItem value="MY_CURRENT_ASSETS">My current assets</MenuItem>
            <MenuItem value="MY_ASSET_HISTORY">My asset history</MenuItem>
          </TextField>
        ) : null}

        <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
          <Button variant="outlined" onClick={clearFilters} fullWidth={isMobile} size="small">
            Clear filter
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ height: 520, bgcolor: "white", borderRadius: 3 }}>
        <DataGrid
          apiRef={apiRef}
          rows={filteredRows}
          columns={columns}
          loading={isLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          onRowClick={(params: GridRowParams<Ticket>) => navigate(`/tickets/${params.row.id}`)}
          getRowClassName={(params) => (highlightId === Number(params.id) ? "row-focus" : "")}
          columnVisibilityModel={columnVisibilityModel}
          sx={{
            "& .row-focus": {
              outline: "2px solid rgba(25, 118, 210, 0.55)",
              outlineOffset: "-2px",
              backgroundColor: "rgba(25, 118, 210, 0.08)",
              transition: "background-color 250ms ease, outline-color 250ms ease",
            },
            borderRadius: 3,
            "& .MuiDataGrid-columnHeaders": {
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            },
          }}
        />
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={openForm} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Ticket" : "Create Ticket"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Asset"
              value={form.asset}
              onChange={(event) => setForm((p) => ({ ...p, asset: event.target.value }))}
              fullWidth
            >
              <MenuItem value="">Select asset</MenuItem>
              {(assets ?? []).map((a) => (
                <MenuItem key={a.id} value={String(a.id)}>
                  {a.name} ({a.serial_number})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Issue"
              value={form.issue}
              onChange={(event) => setForm((p) => ({ ...p, issue: event.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />

            <TextField
              select
              label="Status"
              value={form.status}
              onChange={(event) => setForm((p) => ({ ...p, status: event.target.value as TicketStatus }))}
              fullWidth
              disabled={!isAdmin}
              helperText={!isAdmin ? "Only admin can change status" : ""}
            >
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Assigned Technician"
              value={form.assigned_technician}
              onChange={(event) => setForm((p) => ({ ...p, assigned_technician: event.target.value }))}
              disabled={!isAdmin}
              helperText={!isAdmin ? "Only admin can assign technicians" : ""}
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {(users ?? []).map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {formatUser(u)} ({u.role})
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForm}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={
              createMut.isPending ||
              updateMut.isPending ||
              !form.asset ||
              !form.issue.trim() ||
              (!isAdmin && !!editing)
            }
          >
            {editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark Done Dialog (technician) */}
      <Dialog open={doneOpen} onClose={closeDone} fullWidth maxWidth="sm">
        <DialogTitle>Mark Done</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "text.secondary", fontSize: 13, mt: 1 }}>
            Add a short note like "Replaced keyboard and tested".
          </Typography>

          <TextField
            label="Work note"
            value={doneNote}
            onChange={(e) => setDoneNote(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDone}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => markDoneMut.mutate()}
            disabled={markDoneMut.isPending || !doneTicket}
          >
            {markDoneMut.isPending ? "Saving..." : "Done"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
