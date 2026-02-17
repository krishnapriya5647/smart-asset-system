import { useMemo, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LogoutIcon from "@mui/icons-material/Logout";
import RefreshIcon from "@mui/icons-material/Refresh";
import EmailIcon from "@mui/icons-material/Email";
import PersonIcon from "@mui/icons-material/Person";
import BadgeIcon from "@mui/icons-material/Badge";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { api } from "../api/client";
import { tokenStore } from "../auth/authStore";
import { useNavigate } from "react-router-dom";

type Me = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "EMPLOYEE";
  avatar_url?: string | null;
};

type PatchMePayload = {
  first_name: string;
  last_name: string;
  email: string;
};

type AvatarUploadResponse = {
  avatar_url?: string | null;
};

function initials(first?: string, last?: string, username?: string) {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  if (a || b) {
    const i1 = a ? a[0] : "";
    const i2 = b ? b[0] : "";
    const init = (i1 + i2).toUpperCase();
    return init || (username ?? "?").slice(0, 2).toUpperCase();
  }
  return (username ?? "?").slice(0, 2).toUpperCase();
}

function safeText(v?: string | null) {
  const s = (v ?? "").trim();
  return s ? s : "—";
}

function getErrorMessage(err: unknown): string {
  const e = err as AxiosError<unknown>;
  const data = e?.response?.data as Record<string, unknown> | undefined;

  const detail = typeof data?.detail === "string" ? data.detail : null;

  const email = data?.email;
  const emailMsg = Array.isArray(email) && typeof email[0] === "string" ? email[0] : null;

  if (detail) return detail;
  if (emailMsg) return emailMsg;
  if (typeof e?.message === "string" && e.message) return e.message;

  return "Something went wrong.";
}

export default function Profile() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<PatchMePayload>({ first_name: "", last_name: "", email: "" });
  const [formError, setFormError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  const isAdmin = data?.role === "ADMIN";

  const fullName = useMemo(() => {
    if (!data) return "";
    const n = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
    return n || data.username;
  }, [data]);

  const avatarText = useMemo(
    () => initials(data?.first_name, data?.last_name, data?.username),
    [data?.first_name, data?.last_name, data?.username]
  );

  const roleLabel = useMemo(() => {
    if (!data) return "";
    return data.role === "ADMIN" ? "Administrator" : "Employee";
  }, [data]);

  const avatarSrc = useMemo(() => {
    return localAvatarUrl ?? data?.avatar_url ?? null;
  }, [localAvatarUrl, data?.avatar_url]);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      // ignore
    }
  };

  const logout = () => {
    tokenStore.clear();
    window.location.assign("/login");
  };

  const refresh = async () => {
    await refetch();
    setRefreshedAt(new Date());
  };

  const openEdit = () => {
    if (!data) return;
    setForm({ first_name: data.first_name ?? "", last_name: data.last_name ?? "", email: data.email ?? "" });
    setFormError("");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setFormError("");
  };

  const updateMut = useMutation({
    mutationFn: async () => {
      const payload: PatchMePayload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
      };
      return api.patch<Me>("/api/me/", payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      await refetch();
      setRefreshedAt(new Date());
      closeEdit();
    },
    onError: (err: unknown) => setFormError(getErrorMessage(err)),
  });

  const uploadAvatarMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("avatar", file);
      return api.post<AvatarUploadResponse>("/api/me/avatar/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: async (res) => {
      const url = res.data?.avatar_url ?? null;
      if (url) setLocalAvatarUrl(url);
      await qc.invalidateQueries({ queryKey: ["me"] });
      await refetch();
      setRefreshedAt(new Date());
    },
  });

  const canSave = useMemo(() => {
    const email = form.email.trim();
    const emailOk = email.length === 0 || email.includes("@");
    return emailOk;
  }, [form.email]);

  const pickPhoto = () => fileInputRef.current?.click();

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;
    if (file.size > 3 * 1024 * 1024) return;

    const blobUrl = URL.createObjectURL(file);
    setLocalAvatarUrl(blobUrl);

    uploadAvatarMut.mutate(file);
    e.target.value = "";
  };

  const goMyTickets = () => {
    if (!data) return;
    if (isAdmin) navigate(`/tickets?employee=${data.id}`);
    else navigate("/tickets");
  };

  const goMyAssignments = () => {
    if (!data) return;
    if (isAdmin) navigate(`/assignments?employee=${data.id}`);
    else navigate("/assignments");
  };

  const goMyAssets = () => {
    if (!data) return;
    if (isAdmin) navigate(`/assets?employee=${data.id}`);
    else navigate("/assets");
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Profile
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
            Manage your account details and session.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refresh} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>

          <Button variant="outlined" startIcon={<EditIcon />} onClick={openEdit} disabled={!data}>
            Edit Profile
          </Button>

          <Button color="error" variant="contained" startIcon={<LogoutIcon />} onClick={logout}>
            Logout
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ borderRadius: 3, maxWidth: 820 }}>
        <CardContent>
          {isLoading ? (
            <Typography sx={{ color: "text.secondary" }}>Loading profile...</Typography>
          ) : isError || !data ? (
            <Stack spacing={1}>
              <Typography sx={{ color: "error.main", fontWeight: 600 }}>Failed to load profile</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button variant="outlined" onClick={refresh}>
                  Try again
                </Button>
                <Button color="error" variant="contained" onClick={logout}>
                  Logout
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2.2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                <Avatar sx={{ width: 64, height: 64, fontWeight: 700 }} src={avatarSrc ?? undefined}>
                  {!avatarSrc ? avatarText : null}
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1}
                    sx={{ mb: 0.5 }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
                      {fullName}
                    </Typography>
                    <Chip size="small" label={roleLabel} sx={{ fontWeight: 600 }} />
                  </Stack>

                  <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                    User ID: <b>{data.id}</b> • Last refreshed: <b>{refreshedAt.toLocaleString()}</b>
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                    <Button size="small" variant="outlined" onClick={goMyTickets}>
                      View Tickets
                    </Button>
                    <Button size="small" variant="outlined" onClick={goMyAssignments}>
                      View Assignments
                    </Button>
                    <Button size="small" variant="outlined" onClick={goMyAssets}>
                      View Assets
                    </Button>
                  </Stack>
                </Box>

                <Box>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFileChange} />

                  <Tooltip title="Upload a JPG/PNG up to 3MB">
                    <span>
                      <Button
                        variant="outlined"
                        startIcon={<PhotoCameraIcon />}
                        onClick={pickPhoto}
                        disabled={uploadAvatarMut.isPending}
                      >
                        {uploadAvatarMut.isPending ? "Uploading..." : "Change photo"}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Stack>

              {uploadAvatarMut.isPending ? <LinearProgress /> : null}
              {uploadAvatarMut.isError ? (
                <Typography sx={{ color: "error.main", fontSize: 13 }}>
                  {getErrorMessage(uploadAvatarMut.error)}
                </Typography>
              ) : null}

              <Divider />

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Account</Typography>

                <Stack spacing={1.2}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ p: 1.2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <EmailIcon fontSize="small" />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Email</Typography>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {safeText(data.email)}
                        </Typography>
                      </Box>
                    </Stack>

                    <Tooltip title={copiedKey === "email" ? "Copied" : "Copy"}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => (data.email ? copy("email", data.email) : undefined)}
                          disabled={!data.email}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>

                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ p: 1.2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <PersonIcon fontSize="small" />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Username</Typography>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {safeText(data.username)}
                        </Typography>
                      </Box>
                    </Stack>

                    <Tooltip title={copiedKey === "username" ? "Copied" : "Copy"}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => (data.username ? copy("username", data.username) : undefined)}
                          disabled={!data.username}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>

                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ p: 1.2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <BadgeIcon fontSize="small" />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Access level</Typography>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {roleLabel}
                        </Typography>
                      </Box>
                    </Stack>

                    <Chip size="small" label={data.role} sx={{ fontWeight: 700 }} />
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Edit profile</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="First name"
              value={form.first_name}
              onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Last name"
              value={form.last_name}
              onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
            />

            {formError ? (
              <Typography sx={{ color: "error.main", fontSize: 13 }}>{formError}</Typography>
            ) : (
              <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                Changes update your account details.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={() => updateMut.mutate()} disabled={updateMut.isPending || !canSave}>
            {updateMut.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
