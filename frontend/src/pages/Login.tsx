import { useMemo, useState, type KeyboardEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";

import { api } from "../api/client";
import { tokenStore } from "../auth/authStore";

function parseError(e: unknown) {
  let msg = "Login failed. Please check your username and password.";
  if (typeof e === "object" && e !== null) {
    const errObj = e as { response?: { data?: unknown }; message?: string };
    const data = errObj.response?.data;

    if (typeof data === "string" && data.trim()) {
      msg = data;
    } else if (typeof data === "object" && data !== null) {
      const d = data as Record<string, unknown>;
      const detail = d["detail"];
      if (typeof detail === "string" && detail.trim()) msg = detail;
      else msg = JSON.stringify(d);
    } else if (typeof errObj.message === "string" && errObj.message.trim()) {
      msg = errObj.message;
    }
  }
  return msg;
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0 && !loading;
  }, [username, password, loading]);

  async function submit() {
    if (!canSubmit) return;

    setErr(null);
    setInfo(null);
    setLoading(true);

    try {
      const res = await api.post("/api/auth/login/", {
        username: username.trim(),
        password,
      });

      tokenStore.set(res.data);
      window.location.assign("/");
    } catch (e: unknown) {
      setErr(parseError(e));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") submit();
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        bgcolor: "#d0d0d0",
        backgroundImage:
          "radial-gradient(900px 500px at 15% 10%, rgba(25,118,210,0.16), transparent 55%), radial-gradient(900px 500px at 85% 15%, rgba(156,39,176,0.12), transparent 55%), radial-gradient(900px 500px at 50% 100%, rgba(76,175,80,0.10), transparent 55%)",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 440 }}>
        <Card sx={{ width: "100%", borderRadius: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 950, mb: 0.5 }}>
              Sign in
            </Typography>
            <Typography sx={{ color: "text.secondary", mb: 2 }}>
              Use your account credentials to continue.
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {err ? (
              <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2, borderRadius: 2 }}>
                {err}
              </Alert>
            ) : null}

            {info ? (
              <Alert severity="info" onClose={() => setInfo(null)} sx={{ mb: 2, borderRadius: 2 }}>
                {info}
              </Alert>
            ) : null}

            <Stack spacing={2}>
              <TextField
                fullWidth
                autoFocus
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={onKeyDown}
                inputProps={{ autoComplete: "username" }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
                inputProps={{ autoComplete: "current-password" }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPwd ? "Hide password" : "Show password"}
                        edge="end"
                        onClick={() => setShowPwd((v) => !v)}
                      >
                        {showPwd ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={submit}
                disabled={!canSubmit}
                sx={{ borderRadius: 2.5, fontWeight: 700, py: 1.2 }}
              >
                {loading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <span>Signing in</span>
                  </Stack>
                ) : (
                  "Sign in"
                )}
              </Button>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ color: "text.secondary", fontSize: 12 }}>
                  Press Enter to sign in
                </Typography>

                <Link
                  component={RouterLink}
                  to="/forgot-password"
                  underline="hover"
                  sx={{ fontWeight: 700, fontSize: 12 }}
                >
                  Forgot password?
                </Link>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Auth footer */}
        <Box sx={{ mt: 2, textAlign: "center" }}>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            © {new Date().getFullYear()} Smart Asset System
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
