import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Collapse,
  Fade,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AllInboxOutlinedIcon from "@mui/icons-material/AllInboxOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";

import { PieChart } from "@mui/x-charts/PieChart";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

type Me = { id: number; username: string; role: "ADMIN" | "EMPLOYEE" };

type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "EMPLOYEE";
};

type Asset = {
  id: number;
  name: string;
  serial_number: string;
  status: string;
  type?: string;
};

type DashboardStats = {
  totals: {
    assets_total: number;
    inventory_items_total: number;
    open_tickets: number;
    assigned_assets: number;
  };
  asset_by_status: { status: string; count: number }[];
};

type RecentTicket = {
  id: number;
  status: string;
  issue?: string | null;
  created_at?: string;
  created?: string;
  asset?: number;
  asset_detail?: Asset;
};

type RecentAssignment = {
  id: number;
  date_assigned: string;
  date_returned: string | null;
  asset?: number;
  asset_detail?: Asset;
  employee?: number;
  employee_username?: string;
};

type RecentActivity = {
  tickets: RecentTicket[];
  assignments: RecentAssignment[];
};

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null) {
    const obj = data as { results?: unknown };
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
}

function userDisplay(u: User) {
  const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return name ? `${name} (@${u.username})` : `@${u.username}`;
}

function initialsFromUser(u?: Partial<User> | null) {
  const first = (u?.first_name ?? "").trim();
  const last = (u?.last_name ?? "").trim();
  const i1 = first ? first[0] : "";
  const i2 = last ? last[0] : "";
  const out = (i1 + i2).toUpperCase();
  return out || (u?.username ?? "?").slice(0, 2).toUpperCase();
}

function formatIso(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 16).replace("T", " ");
}

function StatCard(props: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
}) {
  const { title, value, icon, onClick, loading } = props;

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardActionArea
        onClick={onClick}
        disabled={!onClick}
        sx={{ borderRadius: 3, height: "100%", alignItems: "stretch" }}
      >
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: "rgba(0,0,0,0.04)",
              }}
            >
              {icon}
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ color: "text.secondary", fontSize: 13 }}>{title}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.4 }}>
                {loading ? <Skeleton width={70} /> : value}
              </Typography>
            </Box>

            {onClick ? <ArrowForwardIosRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} /> : null}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [assetView, setAssetView] = useState<"ALL" | "ATTN">("ALL");

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = me?.role === "ADMIN";

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    enabled: !!isAdmin,
    queryFn: async () => unwrapList<User>((await api.get("/api/users/")).data),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardStats>("/api/dashboard/")).data,
  });

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["assets_for_dashboard"],
    queryFn: async () => unwrapList<Asset>((await api.get("/api/assets/")).data),
  });

  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["recent_activity"],
    queryFn: async () => (await api.get<RecentActivity>("/api/recent-activity/")).data,
  });

  const totals = stats?.totals;

  const myAssets = useMemo(() => {
    const list = assets ?? [];
    if (assetView === "ALL") return list;
    return list.filter((a) => {
      const s = String(a.status).toUpperCase();
      return s === "REPAIR" || s === "RETIRED";
    });
  }, [assets, assetView]);

  const pieData = useMemo(
    () =>
      (stats?.asset_by_status ?? []).map((x, idx) => ({
        id: idx,
        value: x.count,
        label: x.status,
      })),
    [stats?.asset_by_status]
  );

  const assetLabel = (a?: Asset, id?: number) => {
    if (a) return `${a.name} (${a.serial_number})`;
    if (id != null) {
      const fromList = (assets ?? []).find((x) => x.id === id);
      if (fromList) return `${fromList.name} (${fromList.serial_number})`;
      return `Asset ${id}`;
    }
    return "Asset";
  };

  const recentTickets = recent?.tickets ?? [];
  const recentAssignments = recent?.assignments ?? [];

  const collapsedTickets = 3;
  const collapsedAssignments = 3;
  const activityCollapsedHeight = 260;

  const hasMoreActivity = recentTickets.length > collapsedTickets || recentAssignments.length > collapsedAssignments;

  const shownTickets = showAllActivity ? recentTickets : recentTickets.slice(0, collapsedTickets);
  const shownAssignments = showAllActivity ? recentAssignments : recentAssignments.slice(0, collapsedAssignments);

  const collapsedAssetsCount = 3;
  const hasMoreAssets = myAssets.length > collapsedAssetsCount;
  const assetsToShow = showAllAssets ? myAssets : myAssets.slice(0, collapsedAssetsCount);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 2 }}
        spacing={1.5}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Dashboard
          </Typography>

          <Typography sx={{ color: "text.secondary", fontSize: 13, fontWeight: 400  }}>
            Overview of assets, inventory, and tickets
          </Typography>
        </Box>

        {isAdmin ? (
          <Autocomplete
            loading={usersLoading}
            value={selectedEmployee}
            onChange={(_e, v) => {
              setSelectedEmployee(v);
              if (v) navigate(`/employees/${v.id}`);
            }}
            options={users ?? []}
            getOptionLabel={(o) => userDisplay(o)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ py: 0.5 }}>
                  <Avatar sx={{ width: 28, height: 28, fontWeight: 700, fontSize: 12 }}>
                    {initialsFromUser(option)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 13 }} noWrap>
                      {userDisplay(option)}
                    </Typography>
                    <Typography sx={{ color: "text.secondary", fontSize: 12 }} noWrap>
                      {option.email}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Search employees"
                placeholder="Name, username, or email"
                sx={{ minWidth: { xs: "100%", md: 420 } }}
              />
            )}
          />
        ) : null}
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
          mb: 2,
        }}
      >
        <StatCard
          title="Total Assets"
          value={totals?.assets_total ?? 0}
          loading={statsLoading}
          icon={<AllInboxOutlinedIcon fontSize="small" />}
          onClick={() => navigate("/assets")}
        />
        <StatCard
          title="Inventory Items"
          value={totals?.inventory_items_total ?? 0}
          loading={statsLoading}
          icon={<Inventory2OutlinedIcon fontSize="small" />}
          onClick={() => navigate("/inventory")}
        />
        <StatCard
          title="Open Tickets"
          value={totals?.open_tickets ?? 0}
          loading={statsLoading}
          icon={<ConfirmationNumberOutlinedIcon fontSize="small" />}
          onClick={() => navigate("/tickets")}
        />
        <StatCard
          title="Assigned Assets"
          value={totals?.assigned_assets ?? 0}
          loading={statsLoading}
          icon={<AssignmentTurnedInOutlinedIcon fontSize="small" />}
          onClick={() => navigate("/assets")}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.35fr 1fr" },
          gap: 2,
          alignItems: "start",
          mb: 2,
        }}
      >
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>Asset Status Breakdown</Typography>
                <Typography sx={{ color: "text.secondary" }}>Distribution of assets by status.</Typography>
              </Box>

              {!statsLoading ? (
                <Chip size="small" label={`Total: ${totals?.assets_total ?? 0}`} sx={{ fontWeight: 600 }} />
              ) : (
                <Skeleton width={90} height={28} />
              )}
            </Stack>

            {statsLoading ? (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 220px" }, gap: 2 }}>
                <Skeleton height={240} />
                <Stack spacing={1}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height={28} />
                  ))}
                </Stack>
              </Box>
            ) : pieData.length === 0 ? (
              <Typography sx={{ color: "text.secondary" }}>No data.</Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 220px" }, gap: 2 }}>
                <Box sx={{ width: "100%", overflowX: "auto" }}>
                  <PieChart
                    series={[
                      {
                        data: pieData,
                        innerRadius: 55,
                        outerRadius: 95,
                        paddingAngle: 3,
                        cornerRadius: 4,
                      },
                    ]}
                    height={240}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 1, fontSize: 13, color: "text.secondary" }}>Status</Typography>

                  <Stack spacing={1}>
                    {pieData.map((p) => (
                      <Button
                        key={p.id}
                        variant="outlined"
                        size="small"
                        onClick={() => navigate(`/assets?status=${encodeURIComponent(String(p.label))}`)}
                        sx={{
                          justifyContent: "space-between",
                          borderRadius: 2,
                          textTransform: "none",
                          fontWeight: 600,
                        }}
                      >
                        <span>{String(p.label)}</span>
                        <span>{p.value}</span>
                      </Button>
                    ))}
                  </Stack>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>Assets snapshot</Typography>
              <Button size="small" onClick={() => navigate("/assets")} sx={{ fontWeight: 700 }}>
                View all assets
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
              <Chip
                clickable
                size="small"
                label="All"
                onClick={() => setAssetView("ALL")}
                color={assetView === "ALL" ? "primary" : "default"}
                sx={{ fontWeight: 600 }}
              />
              <Chip
                clickable
                size="small"
                label="Needs attention"
                onClick={() => setAssetView("ATTN")}
                color={assetView === "ATTN" ? "primary" : "default"}
                sx={{ fontWeight: 600 }}
              />
            </Stack>

            <Typography sx={{ color: "text.secondary", mb: 2 }}>
              {isAdmin ? "Use Assets page for full management." : "Assets assigned to you."}
            </Typography>

            {assetsLoading ? (
              <Stack spacing={1.1}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Box key={i} sx={{ p: 1.1, borderRadius: 2, border: "1px solid rgba(0,0,0,0.06)" }}>
                    <Skeleton width="75%" />
                    <Skeleton width="45%" />
                  </Box>
                ))}
              </Stack>
            ) : myAssets.length === 0 ? (
              <Box sx={{ p: 2, borderRadius: 2, border: "1px dashed rgba(0,0,0,0.18)", textAlign: "center" }}>
                <Typography sx={{ fontWeight: 700 }}>No assets to display</Typography>
                <Typography sx={{ color: "text.secondary", fontSize: 13 }}>Try switching the filter above.</Typography>
              </Box>
            ) : (
              <>
                <Fade in>
                  <Box>
                    {assetsToShow.map((a) => (
                      <Box
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/assets?focus=${a.id}`)}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/assets?focus=${a.id}`)}
                        sx={{
                          py: 1,
                          px: 1,
                          borderRadius: 2,
                          cursor: "pointer",
                          border: "1px solid rgba(0,0,0,0.06)",
                          mb: 1,
                          "&:hover": { bgcolor: "rgba(25,118,210,0.06)" },
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {a.name} ({a.serial_number})
                            </Typography>
                            <Typography sx={{ color: "text.secondary", fontSize: 13 }} noWrap>
                              {a.type ?? "—"}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip size="small" label={a.status} />
                            <ArrowForwardIosRoundedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Fade>

                {hasMoreAssets ? (
                  <Box sx={{ textAlign: "center", mt: 1 }}>
                    <Button size="small" onClick={() => setShowAllAssets((v) => !v)}>
                      {showAllAssets ? "Show less" : "Show more"}
                    </Button>
                  </Box>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{ mb: 0.5 }}
            spacing={1}
          >
            <Typography sx={{ fontWeight: 700 }}>Recent Activity</Typography>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
              <Button size="small" onClick={() => navigate("/tickets")} sx={{ fontWeight: 700 }}>
                View all tickets
              </Button>
              {!isMobile ? <Typography sx={{ color: "text.secondary" }}>|</Typography> : null}
              <Button size="small" onClick={() => navigate("/assignments")} sx={{ fontWeight: 700 }}>
                View all assignments
              </Button>
            </Stack>
          </Stack>

          <Typography sx={{ color: "text.secondary", mb: 2 }}>Latest tickets and assignments.</Typography>

          {recentLoading ? (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <Box>
                <Skeleton width={160} height={26} />
                <Stack spacing={1.2} sx={{ mt: 1 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={70} />
                  ))}
                </Stack>
              </Box>
              <Box>
                <Skeleton width={180} height={26} />
                <Stack spacing={1.2} sx={{ mt: 1 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={70} />
                  ))}
                </Stack>
              </Box>
            </Box>
          ) : (
            <Box sx={{ position: "relative" }}>
              <Collapse in={showAllActivity} collapsedSize={activityCollapsedHeight} timeout={280}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, mb: 1 }}>Latest Tickets</Typography>
                    {shownTickets.length === 0 ? (
                      <Typography sx={{ color: "text.secondary" }}>No recent tickets.</Typography>
                    ) : (
                      <Stack spacing={1.2}>
                        {shownTickets.map((t) => {
                          const createdIso = t.created_at ?? t.created;
                          const subtitle = (t.issue ?? "").trim();
                          return (
                            <Box
                              key={t.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => navigate(`/tickets?focus=${t.id}`)}
                              onKeyDown={(e) => e.key === "Enter" && navigate(`/tickets?focus=${t.id}`)}
                              sx={{
                                p: 1.2,
                                borderRadius: 2,
                                cursor: "pointer",
                                border: "1px solid rgba(0,0,0,0.06)",
                                "&:hover": { bgcolor: "rgba(25,118,210,0.06)" },
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 700 }} noWrap>
                                    {assetLabel(t.asset_detail, t.asset)}
                                  </Typography>
                                  {subtitle ? (
                                    <Typography sx={{ fontSize: 13, color: "text.secondary" }} noWrap>
                                      {subtitle}
                                    </Typography>
                                  ) : null}
                                </Box>

                                <Stack spacing={0.6} alignItems="flex-end">
                                  <Chip size="small" label={t.status} />
                                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                                    {formatIso(createdIso)}
                                  </Typography>
                                </Stack>
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>

                  <Box>
                    <Typography sx={{ fontWeight: 600, mb: 1 }}>Latest Assignments</Typography>
                    {shownAssignments.length === 0 ? (
                      <Typography sx={{ color: "text.secondary" }}>No recent assignments.</Typography>
                    ) : (
                      <Stack spacing={1.2}>
                        {shownAssignments.map((a) => (
                          <Box
                            key={a.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/assignments?focus=${a.id}`)}
                            onKeyDown={(e) => e.key === "Enter" && navigate(`/assignments?focus=${a.id}`)}
                            sx={{
                              p: 1.2,
                              borderRadius: 2,
                              cursor: "pointer",
                              border: "1px solid rgba(0,0,0,0.06)",
                              "&:hover": { bgcolor: "rgba(25,118,210,0.06)" },
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700 }} noWrap>
                                  {assetLabel(a.asset_detail, a.asset)}
                                </Typography>
                                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                                  Assigned: {String(a.date_assigned).slice(0, 10)} • Returned:{" "}
                                  {a.date_returned ? String(a.date_returned).slice(0, 10) : "Not returned"}
                                </Typography>
                              </Box>

                              <Chip
                                size="small"
                                label={
                                  !isAdmin
                                    ? "You"
                                    : a.employee_username
                                    ? a.employee_username
                                    : a.employee != null
                                    ? `Employee ${a.employee}`
                                    : "Employee"
                                }
                              />
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Box>
              </Collapse>

              {hasMoreActivity ? (
                <Box sx={{ textAlign: "center", mt: 1.5 }}>
                  <Button size="small" onClick={() => setShowAllActivity((v) => !v)}>
                    {showAllActivity ? "Show less" : "Show more"}
                  </Button>
                </Box>
              ) : null}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
