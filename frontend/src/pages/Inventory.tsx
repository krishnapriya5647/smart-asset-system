import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useMe } from "../auth/useMe";

type InventoryItem = {
  id: number;
  item_type: string;
  quantity: number;
  threshold: number;
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

export default function Inventory() {
  const qc = useQueryClient();

  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN";

  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await api.get("/api/inventory/");
      return unwrapList<InventoryItem>(res.data);
    },
  });

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ item_type: "", quantity: 0, threshold: 5 });

  const createMut = useMutation({
    mutationFn: async () => api.post("/api/inventory/", form),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      closeForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      return api.put(`/api/inventory/${editing.id}/`, form);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      closeForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/inventory/${id}/`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  function openCreate() {
    if (!isAdmin) return;
    setEditing(null);
    setForm({ item_type: "", quantity: 0, threshold: 5 });
    setOpenForm(true);
  }

  function openEdit(row: InventoryItem) {
    if (!isAdmin) return;
    setEditing(row);
    setForm({ item_type: row.item_type, quantity: row.quantity, threshold: row.threshold });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditing(null);
  }

  const onSave = () => {
    if (!isAdmin) return;
    if (!form.item_type) return;
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  const rows = data ?? [];

const baseColumns: GridColDef<InventoryItem>[] = [
  { field: "id", headerName: "ID", width: 80 },
  { field: "item_type", headerName: "Item Type", flex: 1, minWidth: 220 },
  { field: "quantity", headerName: "Quantity", width: 130, type: "number" },
  { field: "threshold", headerName: "Threshold", width: 130, type: "number" },
];

const columns: GridColDef<InventoryItem>[] = isAdmin
  ? [
      ...baseColumns,
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => openEdit(params.row)}>
              Edit
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => deleteMut.mutate(params.row.id)}
              disabled={deleteMut.isPending}
            >
              Delete
            </Button>
          </Stack>
        ),
      },
    ]
  : baseColumns;
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Inventory
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2, alignItems: "center" }}>
        <Typography sx={{ color: "text.secondary", flex: 1 }}>
          Low stock rows are highlighted when quantity is below threshold.
        </Typography>

        {isAdmin && (
          <Button variant="contained" onClick={openCreate} sx={{ minWidth: 160 }}>
            Add Item
          </Button>
        )}
      </Stack>

      <Box sx={{ height: 520, bgcolor: "white", borderRadius: 3 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
          getRowClassName={(p) => (p.row.quantity < p.row.threshold ? "low-stock" : "")}
          sx={{
            "& .low-stock": {
              backgroundColor: "rgba(244,67,54,0.08)",
            },
          }}
        />
      </Box>

      <Dialog open={openForm} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Item Type"
              value={form.item_type}
              onChange={(e) => setForm((p) => ({ ...p, item_type: e.target.value }))}
            />
            <TextField
              label="Quantity"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
            />
            <TextField
              label="Threshold"
              type="number"
              value={form.threshold}
              onChange={(e) => setForm((p) => ({ ...p, threshold: Number(e.target.value) }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForm}>Cancel</Button>
          <Button variant="contained" onClick={onSave} disabled={!isAdmin || createMut.isPending || updateMut.isPending || !form.item_type}>
            {editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
