import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

type Me = { id: number; username: string; role: "ADMIN" | "EMPLOYEE" };

type Employee = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "EMPLOYEE";
  avatar_url?: string | null;
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
  date_assigned: string;
  date_returned: string | null;
  asset: number;
  asset_detail?: Asset;
};

type Ticket = {
  id: number;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  issue?: string | null;
  created_at?: string;
  asset: number;
  asset_detail?: Asset;
};

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null) {
    const obj = data as { results?: unknown };
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
}

function initials(first?: string, last?: string, username?: string) {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  const i1 = a ? a[0] : "";
  const i2 = b ? b[0] : "";
  const out = (i1 + i2).toUpperCase();
  return out || (username ?? "?").slice(0, 2).toUpperCase();
}

function ymd(s?: string | null) {
  if (!s) return "—";
  return String(s).slice(0, 10);
}

export default function EmployeeDetails() {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = me?.role === "ADMIN";

  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: ["employee", employeeId],
    enabled: Number.isFinite(employeeId),
    queryFn: async () => (await api.get<Employee>(`/api/users/${employeeId}/`)).data,
  });

  // These 3 endpoints must be supported by backend filters
  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["employee_assets", employeeId],
    enabled: !!isAdmin && Number.isFinite(employeeId),
    queryFn: async () => unwrapList<Asset>((await api.get(`/api/assets/?employee=${employeeId}`)).data),
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["employee_assignments", employeeId],
    enabled: !!isAdmin && Number.isFinite(employeeId),
    queryFn: async () => unwrapList<Assignment>((await api.get(`/api/assignments/?employee=${employeeId}`)).data),
  });

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["employee_tickets", employeeId],
    enabled: !!isAdmin && Number.isFinite(employeeId),
    queryFn: async () => unwrapList<Ticket>((await api.get(`/api/tickets/?employee=${employeeId}`)).data),
  });

  const fullName = useMemo(() => {
    if (!employee) return "";
    const n = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
    return n || employee.username;
  }, [employee]);

  const avatarText = useMemo(
    () => initials(employee?.first_name, employee?.last_name, employee?.username),
    [employee?.first_name, employee?.last_name, employee?.username]
  );

  const activeAssetsCount = useMemo(() => {
    const list = assets ?? [];
    return list.filter((a) => String(a.status).toUpperCase() === "ASSIGNED").length;
  }, [assets]);

  const openTicketsCount = useMemo(() => {
    const list = tickets ?? [];
    return list.filter((t) => t.status === "OPEN").length;
  }, [tickets]);

  const assignedAssetsTop = useMemo(() => (assets ?? []).slice(0, 5), [assets]);
  const recentAssignments = useMemo(() => (assignments ?? []).slice(0, 5), [assignments]);
  const recentTickets = useMemo(() => (tickets ?? []).slice(0, 5), [tickets]);

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Employee Profile
        </Typography>
        <Typography sx={{ color: "text.secondary" }}>
          Only admins can view employee profiles.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Employee Profile
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
            Employee ID: {Number.isFinite(employeeId) ? employeeId : "—"}
          </Typography>
        </Box>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Stack>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <Avatar
              sx={{ width: 72, height: 72, fontWeight: 700 }}
              src={employee?.avatar_url ?? undefined}
            >
              {!employee?.avatar_url ? avatarText : null}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18 }} noWrap>
                {employeeLoading ? "Loading..." : fullName}
              </Typography>

              <Typography sx={{ color: "text.secondary" }} noWrap>
                @{employee?.username ?? "—"} • {employee?.email ?? "—"}
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                <Chip size="small" label={employee?.role ?? "EMPLOYEE"} sx={{ fontWeight: 700 }} />
                <Chip size="small" label={`${activeAssetsCount} active asset(s)`} sx={{ fontWeight: 600 }} />
                <Chip size="small" label={`${openTicketsCount} open ticket(s)`} sx={{ fontWeight: 600 }} />
              </Stack>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<Inventory2Icon />}
                onClick={() => navigate(`/assets?employee=${employeeId}`)}
              >
                View assets
              </Button>
              <Button
                variant="outlined"
                startIcon={<AssignmentIcon />}
                onClick={() => navigate(`/assignments?employee=${employeeId}`)}
              >
                View assignments
              </Button>
              <Button
                variant="outlined"
                startIcon={<ConfirmationNumberIcon />}
                onClick={() => navigate(`/tickets?employee=${employeeId}`)}
              >
                View tickets
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontWeight: 700, mb: 1 }}>Assigned Assets</Typography>
          {assetsLoading ? (
            <Typography sx={{ color: "text.secondary" }}>Loading assets...</Typography>
          ) : assignedAssetsTop.length === 0 ? (
            <Typography sx={{ color: "text.secondary" }}>No assets found for this employee.</Typography>
          ) : (
            <Stack spacing={1}>
              {assignedAssetsTop.map((a) => (
                <Box
                  key={a.id}
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>
                        {a.name} ({a.serial_number})
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                        {a.type ?? "—"}
                      </Typography>
                    </Box>
                    <Chip size="small" label={a.status} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontWeight: 700, mb: 1 }}>Recent Assignments</Typography>
          {assignmentsLoading ? (
            <Typography sx={{ color: "text.secondary" }}>Loading assignments...</Typography>
          ) : recentAssignments.length === 0 ? (
            <Typography sx={{ color: "text.secondary" }}>No assignments.</Typography>
          ) : (
            <Stack spacing={1}>
              {recentAssignments.map((a) => {
                const label = a.asset_detail
                  ? `${a.asset_detail.name} (${a.asset_detail.serial_number})`
                  : `Asset #${a.asset}`;
                return (
                  <Box
                    key={a.id}
                    sx={{
                      p: 1.2,
                      borderRadius: 2,
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {label}
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                          Assigned: {ymd(a.date_assigned)} • Returned:{" "}
                          {a.date_returned ? ymd(a.date_returned) : "Not returned"}
                        </Typography>
                      </Box>
                      <Chip size="small" label={a.date_returned ? "RETURNED" : "ACTIVE"} />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontWeight: 700, mb: 1 }}>Recent Tickets</Typography>
          {ticketsLoading ? (
            <Typography sx={{ color: "text.secondary" }}>Loading tickets...</Typography>
          ) : recentTickets.length === 0 ? (
            <Typography sx={{ color: "text.secondary" }}>No tickets.</Typography>
          ) : (
            <Stack spacing={1}>
              {recentTickets.map((t) => {
                const label = t.asset_detail
                  ? `${t.asset_detail.name} (${t.asset_detail.serial_number})`
                  : `Asset #${t.asset}`;
                const issue = (t.issue ?? "").trim();
                return (
                  <Box
                    key={t.id}
                    sx={{
                      p: 1.2,
                      borderRadius: 2,
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {label}
                        </Typography>
                        {issue ? (
                          <Typography sx={{ fontSize: 13, color: "text.secondary" }} noWrap>
                            {issue}
                          </Typography>
                        ) : null}
                      </Box>
                      <Chip size="small" label={t.status} />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
