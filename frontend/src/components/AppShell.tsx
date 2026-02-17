import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Badge,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import DevicesIcon from "@mui/icons-material/Devices";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import PersonIcon from "@mui/icons-material/Person";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { tokenStore } from "../auth/authStore";
import NotificationsDrawerContent from "./notifications/NotificationsDrawerContent";

type Me = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "EMPLOYEE";
};

type NotificationItem = {
  id: number;
  title?: string | null;
  message?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  is_read?: boolean | null;
  url?: string | null;
  link?: string | null;
};

const drawerWidth = 260;

const isRead = (n: NotificationItem) => {
  if (n.read_at) return true;
  if (typeof n.is_read === "boolean") return n.is_read;
  return false;
};

export default function AppShell() {
  const loc = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/api/me/")).data,
  });

  // For badge count on the bell icon
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<NotificationItem[]>("/api/notifications/")).data ?? [],
    refetchInterval: 20000,
    staleTime: 5000,
  });

  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  const nav = [
    { to: "/", label: "Dashboard", icon: <DashboardIcon /> },
    { to: "/assets", label: "Assets", icon: <DevicesIcon /> },
    { to: "/inventory", label: "Inventory", icon: <Inventory2Icon /> },
    { to: "/assignments", label: "Assignments", icon: <AssignmentIndIcon /> },
    { to: "/tickets", label: "Tickets", icon: <ConfirmationNumberIcon /> },
    { to: "/profile", label: "Profile", icon: <PersonIcon /> },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f6f7fb" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ bgcolor: "white", color: "black", borderBottom: "1px solid #eee" }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Smart Asset System
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton onClick={() => setNotifOpen(true)} aria-label="notifications">
              <Badge color="error" badgeContent={unreadCount} invisible={unreadCount === 0}>
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>

            {isLoading ? (
              <CircularProgress size={18} />
            ) : (
              <Typography sx={{ color: "text.secondary" }}>
                {me?.username} ({me?.role})
              </Typography>
            )}

            <Button
              variant="outlined"
              onClick={() => {
                tokenStore.clear();
                window.location.href = "/login";
              }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Notifications Drawer */}
      <Drawer anchor="right" open={notifOpen} onClose={() => setNotifOpen(false)}>
        <NotificationsDrawerContent open={notifOpen} setNotifOpen={setNotifOpen} />
      </Drawer>

      {/* Left nav Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid #eee",
          },
        }}
      >
        <Toolbar />
        <List sx={{ px: 1 }}>
          {nav.map((item) => {
            const active =
              loc.pathname === item.to || (item.to === "/" && loc.pathname === "/");

            return (
              <ListItemButton
                key={item.to}
                component={Link}
                to={item.to}
                sx={{
                  borderRadius: 2,
                  my: 0.5,
                  bgcolor: active ? "rgba(25,118,210,0.10)" : "transparent",
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box component="main" sx={{ flex: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
