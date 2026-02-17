import { useMemo } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

type Me = { id: number; username: string; role: "ADMIN" | "EMPLOYEE" };

type Asset = {
  id: number;
  name: string;
  serial_number: string;
  status: string;
  type?: string;
  purchase_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Ticket = {
  id: number;
  asset: number;
  issue: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  created_at: string;
  asset_detail?: Asset;
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

function fmtDateShort(iso?: string | null) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

export default function AssetDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const assetId = Number(id);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = me?.role === "ADMIN";

  const { data: asset, isLoading, isError } = useQuery({
    queryKey: ["asset", assetId],
    enabled: Number.isFinite(assetId) && assetId > 0,
    queryFn: async () => (await api.get<Asset>(`/api/assets/${assetId}/`)).data,
  });

  const title = useMemo(() => {
    if (!asset) return "";
    return `${asset.name} (${asset.serial_number})`;
  }, [asset]);

  // Try real-world approach: filtered API call (if your backend supports ?asset=<id>)
  const { data: ticketsForAssetRaw } = useQuery({
    queryKey: ["tickets_for_asset_details", assetId],
    enabled: Number.isFinite(assetId) && assetId > 0,
    queryFn: async () => {
      try {
        const res = await api.get("/api/tickets/", { params: { asset: assetId } });
        return unwrapList<Ticket>(res.data);
      } catch {
        const res = await api.get("/api/tickets/");
        return unwrapList<Ticket>(res.data);
      }
    },
  });

  const { data: assignmentsForAssetRaw } = useQuery({
    queryKey: ["assignments_for_asset_details", assetId],
    enabled: Number.isFinite(assetId) && assetId > 0,
    queryFn: async () => {
      try {
        const res = await api.get("/api/assignments/", { params: { asset: assetId } });
        return unwrapList<Assignment>(res.data);
      } catch {
        const res = await api.get("/api/assignments/");
        return unwrapList<Assignment>(res.data);
      }
    },
  });

  const ticketsForAsset = useMemo(() => {
    const list = (ticketsForAssetRaw ?? []).filter((t) => t.asset === assetId);
    return list
      .slice()
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      .slice(0, 6);
  }, [ticketsForAssetRaw, assetId]);

  const assignmentsForAsset = useMemo(() => {
    const list = (assignmentsForAssetRaw ?? []).filter((a) => a.asset === assetId);
    return list
      .slice()
      .sort((a, b) => (b.date_assigned || "").localeCompare(a.date_assigned || ""))
      .slice(0, 6);
  }, [assignmentsForAssetRaw, assetId]);

  if (!Number.isFinite(assetId) || assetId <= 0) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Invalid asset id
        </Typography>
        <Button component={RouterLink} to="/assets" variant="outlined">
          Back to Assets
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
            <RouterLink to="/assets" style={{ textDecoration: "none" }}>
              Assets
            </RouterLink>
            {asset ? (
              <>
                {" "}
                / <span style={{ fontWeight: 600 }}>{title}</span>
              </>
            ) : (
              <> / Asset</>
            )}
          </Typography>

          <Typography variant="h5" sx={{ fontWeight: 700 }} noWrap>
            {asset ? title : "Asset Details"}
          </Typography>

          <Typography sx={{ color: "text.secondary", fontSize: 13, mt: 0.5 }}>
            Asset ID: {assetId}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate("/assets")}>
            Back
          </Button>

          {isAdmin && (
            <Button
              variant="contained"
              onClick={() => navigate(`/assets?edit=${assetId}&focus=${assetId}`)}
            >
              Edit
            </Button>
          )}
        </Stack>
      </Stack>

      {isLoading ? (
        <Typography sx={{ color: "text.secondary" }}>Loading…</Typography>
      ) : isError || !asset ? (
        <Typography sx={{ color: "error.main" }}>
          Could not load asset. (Check permissions or id)
        </Typography>
      ) : (
        <Stack spacing={2}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }} noWrap>
                    {title}
                  </Typography>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, flexWrap: "wrap" }}>
                    <Chip size="small" label={asset.status} />
                    {asset.type ? <Chip size="small" variant="outlined" label={asset.type} /> : null}
                    {asset.purchase_date ? (
                      <Chip size="small" variant="outlined" label={`Purchased: ${fmtDateShort(asset.purchase_date)}`} />
                    ) : null}
                  </Stack>

                  {(asset.updated_at || asset.created_at) && (
                    <Typography sx={{ color: "text.secondary", fontSize: 13, mb: 2 }}>
                      {asset.updated_at
                        ? `Updated ${timeAgo(asset.updated_at)}`
                        : asset.created_at
                        ? `Created ${timeAgo(asset.created_at)}`
                        : ""}
                    </Typography>
                  )}

                  <Divider sx={{ mb: 2 }} />

                  <Stack spacing={0.6}>
                    <Typography sx={{ color: "text.secondary" }}>
                      Serial number:{" "}
                      <span style={{ fontWeight: 700 }}>{asset.serial_number}</span>
                    </Typography>
                    <Typography sx={{ color: "text.secondary" }}>
                      Status: <span style={{ fontWeight: 700 }}>{asset.status}</span>
                    </Typography>
                    <Typography sx={{ color: "text.secondary" }}>
                      Type: <span style={{ fontWeight: 700 }}>{asset.type ?? "—"}</span>
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ width: { xs: "100%", md: 360 } }}>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Quick actions</Typography>

                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Button size="small" variant="outlined" onClick={() => navigate("/tickets")}>
                      View all tickets
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => navigate("/assignments")}>
                      View all assignments
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>Latest Tickets</Typography>
                  <Button size="small" onClick={() => navigate("/tickets")}>
                    View all
                  </Button>
                </Stack>

                {ticketsForAsset.length === 0 ? (
                  <Typography sx={{ color: "text.secondary" }}>No tickets for this asset.</Typography>
                ) : (
                  <Stack spacing={1.2}>
                    {ticketsForAsset.map((t) => (
                      <Box
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/tickets/${t.id}`)}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/tickets/${t.id}`)}
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
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {t.asset_detail?.name
                                ? `${t.asset_detail.name} (${t.asset_detail.serial_number})`
                                : `Ticket ${t.id}`}
                            </Typography>

                            <Typography sx={{ fontSize: 13, color: "text.secondary" }} noWrap>
                             {t.issue}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.3 }}>
                             {timeAgo(t.created_at)}
                            </Typography>

                          </Box>

                          <Stack spacing={0.6} alignItems="flex-end">
                            <Chip size="small" label={t.status} />
                            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                              {timeAgo(t.created_at)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>Latest Assignments</Typography>
                  <Button size="small" onClick={() => navigate("/assignments")}>
                    View all
                  </Button>
                </Stack>

                {assignmentsForAsset.length === 0 ? (
                  <Typography sx={{ color: "text.secondary" }}>No assignments for this asset.</Typography>
                ) : (
                  <Stack spacing={1.2}>
                    {assignmentsForAsset.map((a) => (
                      <Box
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/assignments/${a.id}`)}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/assignments/${a.id}`)}
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
                           <Typography sx={{ fontWeight: 600 }} noWrap>
                            {a.asset_detail?.name
                                ? `${a.asset_detail.name} (${a.asset_detail.serial_number})`
                                : `Assignment ${a.id}`}
                            </Typography>

                           <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                                Assigned: {fmtDateShort(a.date_assigned)} • Returned:{" "}
                                {a.date_returned ? fmtDateShort(a.date_returned) : "Not returned"}
                            </Typography>

                            {a.employee_username ? (
                            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.3 }}>
                                {a.employee_username}
                            </Typography>
                            ) : null}

                          </Box>

                          <Chip size="small" label={a.date_returned ? "RETURNED" : "ACTIVE"} />
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
