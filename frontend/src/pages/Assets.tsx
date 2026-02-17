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

type Asset = {
  id: number;
  name: string;
  serial_number: string;
  status: string;
  type?: string;
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

const STATUS_OPTIONS = ["AVAILABLE", "ASSIGNED", "REPAIR", "RETIRED"] as const;

export default function Assets() {
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

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = me?.role === "ADMIN";

  const assetsUrl = useMemo(() => {
    if (isAdmin && employeeParam) return `/api/assets/?employee=${employeeParam}`;
    return "/api/assets/";
  }, [isAdmin, employeeParam]);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", assetsUrl],
    queryFn: async () => unwrapList<Asset>((await api.get(assetsUrl)).data),
  });

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const [form, setForm] = useState({
    name: "",
    serial_number: "",
    status: "AVAILABLE",
    type: "",
  });

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        serial_number: form.serial_number.trim(),
        status: form.status,
        type: form.type.trim() || null,
      };
      return api.post("/api/assets/", payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["assets"] });
      closeForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload = {
        name: form.name.trim(),
        serial_number: form.serial_number.trim(),
        status: form.status,
        type: form.type.trim() || null,
      };
      return api.put(`/api/assets/${editing.id}/`, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["assets"] });
      closeForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/assets/${id}/`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", serial_number: "", status: "AVAILABLE", type: "" });
    setOpenForm(true);
  }

  function openEdit(row: Asset) {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      serial_number: row.serial_number ?? "",
      status: row.status ?? "AVAILABLE",
      type: row.type ?? "",
    });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditing(null);
  }

  const onSave = () => {
    if (!form.name.trim() || !form.serial_number.trim()) return;
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  const filteredRows = useMemo(() => {
    const all = assets ?? [];
    return all.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;

      const q = search.trim().toLowerCase();
      if (q) {
        const t = `${a.name} ${a.serial_number} ${a.status} ${a.type ?? ""}`.toLowerCase();
        if (!t.includes(q)) return false;
      }
      return true;
    });
  }, [assets, statusFilter, search]);

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
    const pending = pendingFocusRef.current;
    if (!pending) return;
    if (pending.targetPage !== paginationModel.page) return;

    window.setTimeout(() => {
      const p = pendingFocusRef.current;
      if (!p) return;

      requestAnimationFrame(() => {
        apiRef.current?.scrollToIndexes({ rowIndex: p.rowIndexWithinPage });
      });

      setHighlightId(p.id);

      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => setHighlightId(null), 4500);

      pendingFocusRef.current = null;
    }, 0);
  }, [paginationModel.page, apiRef]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPaginationModel((p) => ({ ...p, page: 0 }));
    navigate({ pathname: "/assets", search: "" }, { replace: true });
  };

  const columns: GridColDef<Asset>[] = [
    { field: "id", headerName: "ID", width: 80 },
    { field: "name", headerName: "Name", flex: 1, minWidth: 200 },
    { field: "serial_number", headerName: "Serial", width: 200 },
    { field: "type", headerName: "Type", width: 160, valueGetter: (_v, r) => r.type ?? "" },
    { field: "status", headerName: "Status", width: 140 },
    ...(isAdmin
      ? ([
          {
            field: "actions",
            headerName: "Actions",
            width: 260,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(params.row);
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
                    deleteMut.mutate(params.row.id);
                  }}
                  disabled={deleteMut.isPending}
                >
                  Delete
                </Button>
              </Stack>
            ),
          } as GridColDef<Asset>,
        ] as GridColDef<Asset>[])
      : []),
  ];

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
            Assets
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            {isAdmin && employeeParam ? (
              <Chip size="small" label={`Filtered by employee: ${employeeParam}`} sx={{ fontWeight: 600 }} />
            ) : null}
          </Stack>
        </Box>

        {isAdmin ? (
          <Button variant="contained" onClick={openCreate} sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            Add Asset
          </Button>
        ) : null}
      </Stack>

      {/* Filters row (fixed wrapping + button sizing) */}
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

        <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />

        <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}>
          <Button
            variant="outlined"
            onClick={clearFilters}
            size={isMobile ? "small" : "medium"}
            sx={{ whiteSpace: "nowrap" }}
          >
            Clear filters
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
          onRowClick={(params: GridRowParams<Asset>) => navigate(`/assets/${params.row.id}`)}
          getRowClassName={(params) => (highlightId === Number(params.id) ? "row-focus" : "")}
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

      <Dialog open={openForm} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Asset" : "Add Asset"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Serial Number"
              value={form.serial_number}
              onChange={(event) => setForm((p) => ({ ...p, serial_number: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Type"
              value={form.type}
              onChange={(event) => setForm((p) => ({ ...p, type: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Status"
              value={form.status}
              onChange={(event) => setForm((p) => ({ ...p, status: event.target.value }))}
              fullWidth
            >
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
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
            disabled={createMut.isPending || updateMut.isPending || !form.name.trim() || !form.serial_number.trim()}
          >
            {editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
