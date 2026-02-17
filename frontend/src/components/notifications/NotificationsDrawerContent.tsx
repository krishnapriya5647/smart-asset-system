import { useMemo } from "react";
import { Box, Divider, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";

export type NotificationItem = {
  id: number;
  title?: string | null;
  message?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  is_read?: boolean | null;
  url?: string | null;
  link?: string | null;
};

// helpers
const normalizeLink = (n: NotificationItem) => n.link || n.url || "";

const isRead = (n: NotificationItem) => {
  if (n.read_at) return true;
  if (typeof n.is_read === "boolean") return n.is_read;
  return false;
};

// API
async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await api.get("/api/notifications/");
  return res.data ?? [];
}

async function markOneRead(id: number): Promise<void> {
  await api.patch(`/api/notifications/${id}/`, { read: true });
}

async function markAllRead(): Promise<void> {
  await api.post(`/api/notifications/mark-all-read/`, {});
}

// component
type Props = {
  open: boolean;
  setNotifOpen: (v: boolean) => void;
};

export default function NotificationsDrawerContent({
  open,
  setNotifOpen,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: open,
    refetchInterval: open ? 20000 : false,
    staleTime: 5000,
  });

  const unread = useMemo(
    () => notifications.filter((n) => !isRead(n)),
    [notifications]
  );

  const unreadCount = unread.length;

  const markOneReadMut = useMutation({
    mutationFn: (id: number) => markOneRead(id),

    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });

      const prev = qc.getQueryData<NotificationItem[]>(["notifications"]) ?? [];

      qc.setQueryData<NotificationItem[]>(["notifications"], (old = []) =>
        old.map((n) =>
          n.id === id
            ? { ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() }
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
    mutationFn: () => markAllRead(),

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["notifications"] });

      const prev = qc.getQueryData<NotificationItem[]>(["notifications"]) ?? [];

      qc.setQueryData<NotificationItem[]>(["notifications"], (old = []) =>
        old.map((n) => ({
          ...n,
          is_read: true,
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

  const handleOpenNotification = async (n: NotificationItem) => {
    const link = normalizeLink(n);

    if (!isRead(n)) {
      try {
        await markOneReadMut.mutateAsync(n.id);
      } catch {
        // rollback handled in onError
      }
    }

    if (link && link.startsWith("/")) {
      navigate(link);
      setNotifOpen(false);
    }
  };

  return (
    <Box sx={{ width: 420, height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            Notifications (TEST 123)
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            {unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
          </Typography>
        </Box>

        <IconButton
          title="Mark all as read"
          onClick={() => markAllReadMut.mutate()}
          disabled={unreadCount === 0 || markAllReadMut.isPending}
        >
          <DoneAllIcon />
        </IconButton>

        <IconButton title="Close" onClick={() => setNotifOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* List (unread only) */}
      <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 1.5 }}>
        {isLoading ? (
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            Loading...
          </Typography>
        ) : unread.length === 0 ? (
          <Box sx={{ mt: 6, textAlign: "center", opacity: 0.8 }}>
            <NotificationsNoneIcon sx={{ fontSize: 44, mb: 1 }} />
            <Typography variant="body1">No unread notifications</Typography>
          </Box>
        ) : (
          <Stack spacing={1.2}>
            {unread.map((n) => {
              const title = n.title || "Notification";
              const message = n.message || "";
              const time = n.created_at || "";

              return (
                <Box
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenNotification(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleOpenNotification(n);
                  }}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    outline: "none",
                    display: "flex",
                    gap: 1.5,
                    alignItems: "flex-start",
                    "&:hover": { backgroundColor: "action.hover" },
                  }}
                >
                  <Box
                    sx={{
                      mt: 0.9,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: "primary.main",
                      flexShrink: 0,
                    }}
                  />

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                      {title}
                    </Typography>

                    {message ? (
                      <Typography variant="body2" sx={{ opacity: 0.9 }} noWrap>
                        {message}
                      </Typography>
                    ) : null}

                    {time ? (
                      <Typography variant="caption" sx={{ opacity: 0.65 }}>
                        {time}
                      </Typography>
                    ) : null}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
