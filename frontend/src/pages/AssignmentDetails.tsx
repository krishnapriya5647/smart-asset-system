import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
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

type Assignment = {
  id: number;
  asset: number;
  employee: number;
  date_assigned: string;
  date_returned: string | null;

  asset_detail?: Asset;
  employee_username?: string;
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

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return String(iso).slice(0, 19).replace("T", " ");
}

function formatUser(u: User) {
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full ? `${full} (@${u.username})` : `@${u.username}`;
}

// backend wants YYYY-MM-DD (DateField)
function toDateValue(input?: string | null) {
  if (!input) return "";
  const s = String(input).trim();

  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO or any parsable date
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function todayDateValue() {
  return toDateValue(new Date().toISOString());
}

type ApiErrorLike = {
  response?: {
    status?: number;
    data?: unknown;
  };
  message?: string;
};

function asApiErrorLike(err: unknown): ApiErrorLike {
  if (typeof err !== "object" || err === null) return {};
  const e = err as Record<string, unknown>;

  const message = typeof e.message === "string" ? e.message : undefined;

  let response: ApiErrorLike["response"] | undefined;
  const r = e.response;
  if (typeof r === "object" && r !== null) {
    const rr = r as Record<string, unknown>;
    const status = typeof rr.status === "number" ? rr.status : undefined;
    const data = rr.data;
    response = { status, data };
  }

  return { message, response };
}

function extractErrMessage(err: unknown) {
  const e = asApiErrorLike(err);
  const status = e.response?.status;
  const data = e.response?.data;

  if (typeof data === "string" && data.trim()) return status ? `Error ${status}: ${data}` : data;

  if (data && typeof data === "object") {
    try {
      const s = JSON.stringify(data);
      return status ? `Error ${status}: ${s}` : s;
    } catch {
      return status ? `Error ${status}: Request failed` : "Request failed";
    }
  }

  if (e.message) return e.message;
  if (err instanceof Error && err.message) return err.message;

  return "Save failed. Please check backend permissions/fields.";
}

function EditAssignmentDialog(props: {
  open: boolean;
  onClose: () => void;
  assignmentId: number;
  assignment: Assignment;
  users: User[] | undefined;
  isAdmin: boolean;
}) {
  const { open, onClose, assignmentId, assignment, users, isAdmin } = props;
  const qc = useQueryClient();

  const [editEmployee, setEditEmployee] = useState<string>(() => String(assignment.employee));
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "RETURNED">(
    () => (assignment.date_returned ? "RETURNED" : "ACTIVE")
  );
  const [editReturnedDate, setEditReturnedDate] = useState<string>(() => toDateValue(assignment.date_returned));
  const [errMsg, setErrMsg] = useState<string>("");

  const updateMut = useMutation({
    mutationFn: async () => {
      setErrMsg("");

      const employeeNum = Number(editEmployee);

      const returnedDate =
        editStatus === "ACTIVE"
          ? null
          : (editReturnedDate && /^\d{4}-\d{2}-\d{2}$/.test(editReturnedDate) ? editReturnedDate : todayDateValue());

      const patchPayload = {
        employee: employeeNum,
        date_returned: returnedDate,
      };

      const putPayload = {
        id: assignment.id,
        asset: assignment.asset,
        employee: employeeNum,
        date_assigned: assignment.date_assigned,
        date_returned: returnedDate,
      };

      try {
        return await api.patch(`/api/assignments/${assignmentId}/`, patchPayload);
      } catch (e) {
        const status = asApiErrorLike(e).response?.status;
        if (status === 405 || status === 400) {
          return await api.put(`/api/assignments/${assignmentId}/`, putPayload);
        }
        throw e;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
        qc.invalidateQueries({ queryKey: ["assignments"] }),
        qc.invalidateQueries({ queryKey: ["assets"] }),
      ]);
      onClose();
    },
    onError: (e) => {
      setErrMsg(extractErrMessage(e));
    },
  });

  const employeeValid = Number.isFinite(Number(editEmployee)) && Number(editEmployee) > 0;
  const returnedValid =
    editStatus === "ACTIVE" || (editReturnedDate.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(editReturnedDate));

  const canSave = isAdmin && employeeValid && returnedValid;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Assignment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {errMsg.length > 0 ? (
            <Typography sx={{ color: "error.main", fontSize: 13 }}>{errMsg}</Typography>
          ) : null}

          <TextField
            select
            label="Employee"
            value={editEmployee}
            onChange={(e) => setEditEmployee(e.target.value)}
            fullWidth
            disabled={!isAdmin || updateMut.isPending}
          >
            <MenuItem value="">Select employee</MenuItem>
            {(users ?? []).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {formatUser(u)} {u.role ? `(${u.role})` : ""}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            value={editStatus}
            onChange={(e) => {
              const v = e.target.value as "ACTIVE" | "RETURNED";
              setEditStatus(v);

              if (v === "ACTIVE") {
                setEditReturnedDate("");
              } else if (!editReturnedDate) {
                setEditReturnedDate(todayDateValue());
              }
            }}
            fullWidth
            disabled={!isAdmin || updateMut.isPending}
          >
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="RETURNED">RETURNED</MenuItem>
          </TextField>

          <TextField
            label="Returned date"
            type="date"
            value={editReturnedDate}
            onChange={(e) => setEditReturnedDate(e.target.value)}
            fullWidth
            disabled={!isAdmin || updateMut.isPending || editStatus !== "RETURNED"}
            InputLabelProps={{ shrink: true }}
            helperText={editStatus !== "RETURNED" ? "Set status to RETURNED to edit this" : "Format: YYYY-MM-DD"}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={updateMut.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => updateMut.mutate()}
          disabled={!canSave || updateMut.isPending}
        >
          {updateMut.isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AssignmentDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const assignmentId = Number(id);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = me?.role === "ADMIN";

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => unwrapList<User>((await api.get("/api/users/")).data),
  });

  const { data: assignment, isLoading, isError } = useQuery({
    queryKey: ["assignment", assignmentId],
    enabled: Number.isFinite(assignmentId) && assignmentId > 0,
    queryFn: async () => (await api.get<Assignment>(`/api/assignments/${assignmentId}/`)).data,
  });

  const assetTitle = useMemo(() => {
    if (!assignment) return "";
    const a = assignment.asset_detail;
    if (a?.name && a?.serial_number) return `${a.name} (${a.serial_number})`;
    return `Asset #${assignment.asset}`;
  }, [assignment]);

  const employeeLabel = useMemo(() => {
    if (!assignment) return "";
    const u = (users ?? []).find((x) => x.id === assignment.employee);
    if (u) return formatUser(u);
    if (assignment.employee_username) return assignment.employee_username;
    return `User #${assignment.employee}`;
  }, [assignment, users]);

  const statusText = useMemo(() => {
    if (!assignment) return "";
    return assignment.date_returned ? "RETURNED" : "ACTIVE";
  }, [assignment]);

  const [editOpen, setEditOpen] = useState(false);

  if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Invalid assignment id
        </Typography>
        <Button component={RouterLink} to="/assignments" variant="outlined">
          Back to Assignments
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
            <RouterLink to="/assignments" style={{ textDecoration: "none" }}>
              Assignments
            </RouterLink>
            {assignment ? (
              <>
                {" "}
                / <span style={{ fontWeight: 600 }}>{assetTitle}</span>
              </>
            ) : (
              <> / Assignment</>
            )}
          </Typography>

          <Typography variant="h5" sx={{ fontWeight: 700 }} noWrap>
            {assignment ? assetTitle : "Assignment Details"}
          </Typography>

          <Typography sx={{ color: "text.secondary", fontSize: 13, mt: 0.5 }}>
            Assignment ID: {assignmentId}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate("/assignments")}>
            Back
          </Button>

          {isAdmin && (
            <Button
              variant="contained"
              onClick={() => setEditOpen(true)}
              disabled={isLoading || isError || !assignment}
            >
              Edit
            </Button>
          )}
        </Stack>
      </Stack>

      {isLoading ? (
        <Typography sx={{ color: "text.secondary" }}>Loading…</Typography>
      ) : isError || !assignment ? (
        <Typography sx={{ color: "error.main" }}>
          Could not load assignment. (Check permissions or id)
        </Typography>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }} noWrap>
                  {assetTitle}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
                  <Chip size="small" label={statusText} />
                  <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                    Assigned {timeAgo(assignment.date_assigned)}
                  </Typography>
                  <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                    ({fmtDate(assignment.date_assigned)})
                  </Typography>
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Dates</Typography>
                <Stack spacing={0.5}>
                  <Typography sx={{ color: "text.secondary" }}>
                    Assigned:{" "}
                    <span style={{ color: "inherit", fontWeight: 600 }}>
                      {fmtDate(assignment.date_assigned)}
                    </span>
                  </Typography>
                  <Typography sx={{ color: "text.secondary" }}>
                    Returned:{" "}
                    <span style={{ color: "inherit", fontWeight: 600 }}>
                      {assignment.date_returned ? fmtDate(assignment.date_returned) : "Not returned"}
                    </span>
                  </Typography>
                </Stack>
              </Box>

              <Box sx={{ width: { xs: "100%", md: 320 } }}>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Details</Typography>

                <Stack spacing={1}>
                  <Box>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Employee</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{employeeLabel}</Typography>
                  </Box>

                  <Box>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Asset status</Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {assignment.asset_detail?.status ?? "—"}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {isAdmin && editOpen && assignment ? (
        <EditAssignmentDialog
          key={`${assignment.id}-${assignment.employee}-${assignment.date_returned ?? "ACTIVE"}`}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          assignmentId={assignmentId}
          assignment={assignment}
          users={users}
          isAdmin={isAdmin}
        />
      ) : null}
    </Box>
  );
}
