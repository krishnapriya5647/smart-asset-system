// frontend/src/pages/Assignments.tsx

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Chip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRowParams,
  type GridPaginationModel,
  useGridApiRef,
} from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

type Me = { id: number; username: string; role: "ADMIN" | "EMPLOYEE" };

type User = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "EMPLOYEE";
};

type Asset = { id: number; name: string; serial_number: string; status: string };

type Assignment = {
  id: number;
  asset: number;
  employee: number;
  date_assigned: string;
  date_returned: string | null;
  asset_detail?: Asset;
  employee_detail?: User;
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

function ymd(s?: string | null) {
  if (!s) return "";
  return String(s).slice(0, 10);
}

type ReturnFilter = "ALL" | "RETURNED" | "NOT_RETURNED";

export default function Assignments() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const apiRef = useGridApiRef();

  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));

  // Parse params without useMemo
  const focusParam = searchParams.get("focus");
  const focusNum = focusParam ? Number(focusParam) : NaN;
  const focusId = Number.isFinite(focusNum) ? focusNum : null;

  const employeeParamRaw = searchParams.get("employee");
  const employeeNum = employeeParamRaw ? Number(employeeParamRaw) : NaN;
  const employeeParam = Number.isFinite(employeeNum) ? employeeNum : null;

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = me?.role === "ADMIN";

  const { data: assets } = useQuery({
    queryKey: ["assets_dropdown_assignments"],
    queryFn: async () => unwrapList<Asset>((await api.get("/api/assets/")).data),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    enabled: !!isAdmin,
    queryFn: async () => unwrapList<User>((await api.get("/api/users/")).data),
  });

  const assignmentsUrl =
    isAdmin && employeeParam ? `/api/assignments/?employee=${employeeParam}` : "/api/assignments/";

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", assignmentsUrl],
    queryFn: async () => unwrapList<Assignment>((await api.get(assignmentsUrl)).data),
  });

  const assetLabel = (assetId: number) => {
    const a = (assets ?? []).find((x) => x.id === assetId);
    return a ? `${a.name} (${a.serial_number})` : `Asset #${assetId}`;
  };

  const userLabel = (userId: number) => {
    const u = (users ?? []).find((x) => x.id === userId);
    if (!u) return `User #${userId}`;
    const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
    return full ? `${full} (@${u.username})` : `@${u.username}`;
  };

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);

  const [form, setForm] = useState({
    asset: "" as string,
    employee: "" as string,
    date_assigned: "" as string,
    date_returned: "" as string,
  });

  const [search, setSearch] = useState("");
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>("ALL");

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        asset: Number(form.asset),
        employee: Number(form.employee),
        date_assigned: form.date_assigned,
        date_returned: form.date_returned || null,
      };
      return api.post("/api/assignments/", payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["assignments"] });
      closeForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload = {
        asset: Number(form.asset),
        employee: Number(form.employee),
        date_assigned: form.date_assigned,
        date_returned: form.date_returned || null,
      };
      return api.put(`/api/assignments/${editing.id}/`, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["assignments"] });
      closeForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/assignments/${id}/`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({
      asset: "",
      employee: employeeParam && isAdmin ? String(employeeParam) : "",
      date_assigned: ymd(new Date().toISOString()),
      date_returned: "",
    });
    setOpenForm(true);
  }

  function openEdit(row: Assignment) {
    setEditing(row);
    setForm({
      asset: String(row.asset),
      employee: String(row.employee),
      date_assigned: ymd(row.date_assigned),
      date_returned: row.date_returned ? ymd(row.date_returned) : "",
    });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditing(null);
  }

  const onSave = () => {
    if (!form.asset || !form.employee || !form.date_assigned) return;
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  const filteredRows: Assignment[] = (() => {
    const all = assignments ?? [];

    const byReturn = all.filter((a) => {
      if (returnFilter === "ALL") return true;
      if (returnFilter === "RETURNED") return !!a.date_returned;
      return !a.date_returned;
    });

    const q = search.trim().toLowerCase();
    if (!q) return byReturn;

    return byReturn.filter((a) => {
      const assetText = assetLabel(a.asset).toLowerCase();
      const empText = isAdmin ? userLabel(a.employee).toLowerCase() : "";
      const dateText = `${ymd(a.date_assigned)} ${ymd(a.date_returned)}`.toLowerCase();
      return assetText.includes(q) || empText.includes(q) || dateText.includes(q);
    });
  })();

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
    setReturnFilter("ALL");
    setPaginationModel((p) => ({ ...p, page: 0 }));
    navigate({ pathname: "/assignments", search: "" }, { replace: true });
  };

  const columns: GridColDef<Assignment>[] = [
    { field: "id", headerName: "ID", width: 80 },
    {
      field: "asset",
      headerName: "Asset",
      flex: 1,
      minWidth: 240,
      valueGetter: (_v, r) => assetLabel(r.asset),
    },
    ...(isAdmin
      ? ([
          {
            field: "employee",
            headerName: "Employee",
            width: 240,
            valueGetter: (_v, r) => userLabel(r.employee),
          },
        ] as GridColDef<Assignment>[])
      : []),
    {
      field: "date_assigned",
      headerName: "Assigned",
      width: 130,
      valueGetter: (_v, r) => ymd(r.date_assigned),
    },
    {
      field: "date_returned",
      headerName: "Returned",
      width: 150,
      valueGetter: (_v, r) => (r.date_returned ? ymd(r.date_returned) : "Not returned"),
    },
    ...(isAdmin
      ? ([
          {
            field: "actions",
            headerName: "Actions",
            width: isXs ? 200 : 260,
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
          },
        ] as GridColDef<Assignment>[])
      : []),
  ];

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Assignments
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
            {isAdmin && employeeParam ? (
              <Chip size="small" label={`Filtered by employee: ${employeeParam}`} sx={{ fontWeight: 600 }} />
            ) : null}
          </Stack>
        </Box>

        {isAdmin ? (
          <Button variant="contained" onClick={openCreate} fullWidth={isXs} sx={{ minWidth: { sm: 200 } }}>
            Create Assignment
          </Button>
        ) : null}
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 2 }}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth={isXs}
          sx={{ width: { sm: 320 } }}
        />

        <TextField
          size="small"
          select
          label="Return status"
          value={returnFilter}
          onChange={(event) => setReturnFilter(event.target.value as ReturnFilter)}
          fullWidth={isXs}
          sx={{ width: { sm: 200 } }}
        >
          <MenuItem value="ALL">All</MenuItem>
          <MenuItem value="NOT_RETURNED">Not returned</MenuItem>
          <MenuItem value="RETURNED">Returned</MenuItem>
        </TextField>

        <Box sx={{ flex: 1, display: { xs: "none", sm: "block" } }} />

        <Button variant="outlined" onClick={clearFilters} fullWidth={isXs} sx={{ minWidth: { sm: 160 } }}>
          Clear filter
        </Button>
      </Stack>

      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.06)",
          height: 520,
        }}
      >
        <DataGrid
          apiRef={apiRef}
          rows={filteredRows}
          columns={columns}
          loading={isLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          onRowClick={(params: GridRowParams<Assignment>) => navigate(`/assignments/${params.row.id}`)}
          getRowClassName={(params) => (highlightId === Number(params.id) ? "row-focus" : "")}
          sx={{
            border: "none",
            "& .row-focus": {
              outline: "2px solid rgba(25, 118, 210, 0.55)",
              outlineOffset: "-2px",
              backgroundColor: "rgba(25, 118, 210, 0.08)",
              transition: "background-color 250ms ease, outline-color 250ms ease",
            },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "rgba(0,0,0,0.02)",
            },
          }}
        />
      </Box>

      <Dialog open={openForm} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Assignment" : "Create Assignment"}</DialogTitle>
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
              select
              label="Employee"
              value={form.employee}
              onChange={(event) => setForm((p) => ({ ...p, employee: event.target.value }))}
              fullWidth
              disabled={!isAdmin}
            >
              <MenuItem value="">Select employee</MenuItem>
              {(users ?? []).map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.username} ({u.role})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Date assigned"
              type="date"
              value={form.date_assigned}
              onChange={(event) => setForm((p) => ({ ...p, date_assigned: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Date returned"
              type="date"
              value={form.date_returned}
              onChange={(event) => setForm((p) => ({ ...p, date_returned: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeForm}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={createMut.isPending || updateMut.isPending || !form.asset || !form.employee || !form.date_assigned}
          >
            {editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
