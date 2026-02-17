import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import PersonIcon from "@mui/icons-material/Person";
import DevicesOtherIcon from "@mui/icons-material/DevicesOther";

import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import CircleRoundedIcon from "@mui/icons-material/CircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api/client";
import { tokenStore } from "./auth/authStore";
import { themeStore, type ThemeMode } from "./theme/themeStore";

type Me = { id: number; username: string; role: "ADMIN" | "EMPLOYEE" };

type NotificationItem = {
  id: number;
  title?: string;
  desc?: string;
  message?: string;
  type?: string;
  created_at?: string;
  created?: string;

  // backend read fields
  read_at?: string | null;
  is_read?: boolean | null;

  // legacy fields (some APIs use these)
  read?: boolean;

  url?: string;
  link?: string;
};

const DRAWER_OPEN_WIDTH = 240;
const DRAWER_CLOSED_WIDTH = 76;

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const results = obj["results"];
    if (Array.isArray(results)) return results as T[];
  }
  return [];
}

function getCreatedIso(n: NotificationItem) {
  return n.created_at ?? n.created ?? "";
}

function formatIso(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 16).replace("T", " ");
}

function getTitle(n: NotificationItem) {
  if (n.title && n.title.trim()) return n.title;
  if (n.type && n.type.trim()) return n.type.replaceAll("_", " ");
  return "Notification";
}

function getBody(n: NotificationItem) {
  if (n.desc && n.desc.trim()) return n.desc;
  if (n.message && n.message.trim()) return n.message;
  return "";
}

function isRead(n: NotificationItem) {
  // IMPORTANT: backend marks read using read_at
  if (n.read_at) return true;
  if (typeof n.is_read === "boolean") return n.is_read;
  if (typeof n.read === "boolean") return n.read;
  return false;
}

function initialsFromUsername(username?: string) {
  const u = (username ?? "?").trim();
  if (!u) return "?";
  return u.slice(0, 2).toUpperCase();
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const tokens = tokenStore.get();

  useEffect(() => {
    if (!tokens?.access) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }
  }, [tokens?.access, navigate, location.pathname]);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const v = localStorage.getItem("sidebar_open");
    return v === null ? true : v === "1";
  });

  useEffect(() => {
    localStorage.setItem("sidebar_open", sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const drawerWidthDesktop = sidebarOpen ? DRAWER_OPEN_WIDTH : DRAWER_CLOSED_WIDTH;

  const { data: me, isLoading: meLoading, isError: meError } = useQuery({
    queryKey: ["me"],
    enabled: !!tokens?.access,
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
    retry: false,
  });

  const roleLabel = useMemo(() => {
    if (!me) return "";
    return me.role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
  }, [me]);

  const logout = () => {
    tokenStore.clear();
    navigate("/login", { replace: true });
  };

  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifications, isLoading: notifLoading } = useQuery({
    queryKey: ["notifications"],
    enabled: !!tokens?.access,
    queryFn: async () => {
      try {
        const res = await api.get("/api/notifications/");
        return unwrapList<NotificationItem>(res.data);
      } catch (e: unknown) {
        const err = e as { response?: { status?: number } };
        if (err?.response?.status === 404) return [];
        throw e;
      }
    },
    refetchInterval: 20000,
  });

  const unreadOnly = useMemo(() => {
    return (notifications ?? []).filter((n) => !isRead(n));
  }, [notifications]);

  const unreadCount = unreadOnly.length;

  const markOneReadMut = useMutation({
    mutationFn: async (id: number) =>
      (await api.patch(`/api/notifications/${id}/`, { read: true })).data,

    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<NotificationItem[]>(["notifications"]) ?? [];

      qc.setQueryData<NotificationItem[]>(["notifications"], (old = []) =>
        old.map((n) =>
          n.id === id
            ? {
                ...n,
                is_read: true,
                read: true,
                read_at: n.read_at ?? new Date().toISOString(),
              }
            : n
        )
      );

      return { prev };
    },

    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },

    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMut = useMutation({
    mutationFn: async () => {
      // try the bulk endpoint first
      try {
        return await api.post(`/api/notifications/mark-all-read/`, {});
      } catch {
        // fallback: patch each unread
        const list = notifications ?? [];
        const unread = list.filter((n) => !isRead(n));
        for (const n of unread) {
          try {
            await api.patch(`/api/notifications/${n.id}/`, { read: true });
          } catch {
            // ignore single notification failure
          }
        }
        return null;
      }
    },

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<NotificationItem[]>(["notifications"]) ?? [];

      qc.setQueryData<NotificationItem[]>(["notifications"], (old = []) =>
        old.map((n) => ({
          ...n,
          is_read: true,
          read: true,
          read_at: n.read_at ?? new Date().toISOString(),
        }))
      );

      return { prev };
    },

    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },

    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const navItems = [
    { to: "/", label: "Dashboard", icon: <DashboardIcon /> },
    { to: "/assets", label: "Assets", icon: <DevicesOtherIcon /> },
    { to: "/inventory", label: "Inventory", icon: <Inventory2Icon /> },
    { to: "/assignments", label: "Assignments", icon: <AssignmentIcon /> },
    { to: "/tickets", label: "Tickets", icon: <ConfirmationNumberIcon /> },
    { to: "/profile", label: "Profile", icon: <PersonIcon /> },
  ];

  const [mode, setMode] = useState<ThemeMode>(() => themeStore.get());

  useEffect(() => {
    const onChange = () => setMode(themeStore.get());
    window.addEventListener("theme_mode_changed", onChange);
    return () => window.removeEventListener("theme_mode_changed", onChange);
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    themeStore.set(next);
  };

  const SidebarContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ px: 1 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ width: "100%" }}
          spacing={1}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor:
                  mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(25,118,210,0.10)",
                flexShrink: 0,
              }}
            >
              <AppsRoundedIcon fontSize="small" />
            </Box>

            {isMobile ? (
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, lineHeight: 1.1 }} noWrap>
                  Smart Asset System
                </Typography>
              </Box>
            ) : sidebarOpen ? (
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, lineHeight: 1.1 }} noWrap>
                  Smart Asset
                </Typography>
                <Typography sx={{ color: "text.secondary", fontSize: 12 }} noWrap>
                  System
                </Typography>
              </Box>
            ) : null}
          </Stack>

          {isMobile ? (
            <Tooltip title="Close">
              <IconButton
                size="small"
                onClick={() => setMobileDrawerOpen(false)}
                sx={{ borderRadius: 2 }}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
              <IconButton
                size="small"
                onClick={() => setSidebarOpen((v) => !v)}
                sx={{ borderRadius: 2 }}
              >
                {sidebarOpen ? (
                  <ChevronLeftRoundedIcon />
                ) : (
                  <ChevronRightRoundedIcon />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Toolbar>

      <Divider />

      <List sx={{ px: 1, pt: 1 }}>
        {navItems.map((it) => (
          <ListItemButton
            key={it.to}
            component={NavLink}
            to={it.to}
            end={it.to === "/"}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              minHeight: 44,
              justifyContent: !isMobile && !sidebarOpen ? "center" : "initial",
              px: 1.25,
              "&.active": {
                bgcolor:
                  mode === "dark"
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(25,118,210,0.10)",
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: !isMobile && !sidebarOpen ? 0 : 1.5,
                justifyContent: "center",
                color: "inherit",
              }}
            >
              {it.icon}
            </ListItemIcon>
            {!isMobile && !sidebarOpen ? null : <ListItemText primary={it.label} />}
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ mt: "auto", p: 1.25 }}>
        <Divider sx={{ mb: 1.25 }} />
        <Box
          sx={{
            border:
              mode === "dark"
                ? "1px solid rgba(255,255,255,0.10)"
                : "1px solid rgba(0,0,0,0.08)",
            borderRadius: 2,
            p: 1.2,
            bgcolor: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
          }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Avatar sx={{ width: 34, height: 34, fontWeight: 700 }}>
              {initialsFromUsername(me?.username)}
            </Avatar>

            {!isMobile && !sidebarOpen ? null : (
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>
                  {me?.username ?? "User"}
                </Typography>
                <Typography sx={{ color: "text.secondary", fontSize: 12 }} noWrap>
                  {me ? roleLabel : ""}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { xs: "100%", md: `calc(100% - ${drawerWidthDesktop}px)` },
          ml: { xs: 0, md: `${drawerWidthDesktop}px` },
          bgcolor: "background.paper",
          color: "text.primary",
          borderBottom:
            mode === "dark"
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isMobile ? (
              <IconButton
                onClick={() => setMobileDrawerOpen(true)}
                sx={{ borderRadius: 2 }}
                size="small"
              >
                <MenuRoundedIcon />
              </IconButton>
            ) : null}
          </Box>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              px: 2,
            }}
          >
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: 14,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {me ? `Hi, welcome ${me.username}.` : ""}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
            <Tooltip title={mode === "dark" ? "Switch to light" : "Switch to dark"}>
              <IconButton onClick={toggleTheme} sx={{ borderRadius: 2 }} size="small">
                {mode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Notifications">
              <IconButton
                onClick={() => setNotifOpen(true)}
                sx={{ borderRadius: 2 }}
                size="small"
              >
                <Badge
                  badgeContent={unreadCount}
                  color="primary"
                  invisible={unreadCount === 0}
                >
                  <NotificationsNoneRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            {!isMobile ? (
              meLoading ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}>
                  <CircularProgress size={18} />
                  <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                    Loading...
                  </Typography>
                </Box>
              ) : meError ? (
                <Typography sx={{ fontSize: 14, color: "error.main", pr: 1 }}>
                  Session error
                </Typography>
              ) : (
                <Typography sx={{ fontWeight: 600, fontSize: 14, pr: 1 }}>
                  {me?.username ?? ""} {me ? `(${roleLabel})` : ""}
                </Typography>
              )
            ) : null}

            <Button
              variant="outlined"
              onClick={logout}
              size={isMobile ? "small" : "medium"}
              sx={{ textTransform: "none" }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {!isMobile ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidthDesktop,
            flexShrink: 0,
            whiteSpace: "nowrap",
            [`& .MuiDrawer-paper`]: {
              width: drawerWidthDesktop,
              overflowX: "hidden",
              boxSizing: "border-box",
              borderRight:
                mode === "dark"
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid rgba(0,0,0,0.08)",
              transition: "width 180ms ease",
              bgcolor: "background.paper",
            },
          }}
        >
          {SidebarContent}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: 280, bgcolor: "background.paper" } }}
        >
          {SidebarContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "background.default",
          minHeight: "100vh",
          width: { xs: "100%", md: `calc(100% - ${drawerWidthDesktop}px)` },
          p: { xs: 2, md: 3 },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      {/* Notifications Drawer */}
      <Drawer
        anchor="right"
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, bgcolor: "background.paper" } }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom:
              mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 18 }}>Notifications</Typography>
              <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Mark all as read">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => markAllReadMut.mutate()}
                    disabled={markAllReadMut.isPending || unreadCount === 0}
                    sx={{ borderRadius: 2 }}
                  >
                    <DoneAllRoundedIcon />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title="Close">
                <IconButton size="small" onClick={() => setNotifOpen(false)} sx={{ borderRadius: 2 }}>
                  <CloseRoundedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        {/* UNREAD ONLY LIST */}
        <Box sx={{ p: 1 }}>
          {notifLoading ? (
            <Box sx={{ p: 2 }}>
              <Typography sx={{ color: "text.secondary" }}>Loading...</Typography>
            </Box>
          ) : unreadOnly.length === 0 ? (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 700 }}>No unread notifications</Typography>
              <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                You are all caught up.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {unreadOnly.map((n) => {
                const title = getTitle(n);
                const body = getBody(n);
                const when = formatIso(getCreatedIso(n));
                const link = n.url ?? n.link ?? "";

                return (
                  <ListItem
                    key={n.id}
                    disableGutters
                    sx={{
                      borderRadius: 2,
                      mb: 0.75,
                      px: 1,
                      py: 0.5,
                      border:
                        mode === "dark"
                          ? "1px solid rgba(255,255,255,0.10)"
                          : "1px solid rgba(0,0,0,0.06)",
                      bgcolor:
                        mode === "dark"
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(25,118,210,0.06)",
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 44 }}>
                      <Avatar
                        sx={{
                          width: 34,
                          height: 34,
                          bgcolor:
                            mode === "dark"
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.06)",
                          color: "text.primary",
                        }}
                      >
                        <NotificationsNoneRoundedIcon fontSize="small" />
                      </Avatar>
                    </ListItemAvatar>

                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={async () => {
                        await markOneReadMut.mutateAsync(n.id);

                        if (link && link.startsWith("/")) {
                          navigate(link);
                          setNotifOpen(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          markOneReadMut.mutate(n.id);
                          if (link && link.startsWith("/")) {
                            navigate(link);
                            setNotifOpen(false);
                          }
                        }
                      }}
                      style={{ cursor: link ? "pointer" : "default", width: "100%" }}
                    >
                      <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>
                        {title}
                      </Typography>

                      {body ? (
                        <Typography sx={{ color: "text.secondary", fontSize: 12 }} noWrap>
                          {body}
                        </Typography>
                      ) : null}

                      {when ? (
                        <Typography sx={{ color: "text.secondary", fontSize: 11, mt: 0.4 }}>
                          {when}
                        </Typography>
                      ) : null}
                    </Box>

                    <ListItemSecondaryAction>
                      <Tooltip title="Unread">
                        <CircleRoundedIcon sx={{ fontSize: 10, color: "primary.main" }} />
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
