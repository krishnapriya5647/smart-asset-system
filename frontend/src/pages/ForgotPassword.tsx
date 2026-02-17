import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
  Link,
} from "@mui/material";
import { api } from "../api/client";

function parseError(e: unknown) {
  const msg = "Could not send reset link.";  if (typeof e === "object" && e !== null) {
    const errObj = e as { response?: { data?: unknown }; message?: string };
    const data = errObj.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (typeof data === "object" && data !== null) {
      const d = data as Record<string, unknown>;
      const detail = d["detail"];
      if (typeof detail === "string" && detail.trim()) return detail;
      return JSON.stringify(d);
    }
    if (typeof errObj.message === "string" && errObj.message.trim()) return errObj.message;
  }
  return msg;
}

export default function ForgotPassword() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => value.trim().length > 0 && !loading, [value, loading]);

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setOkMsg(null);
    setErrMsg(null);

    try {
      await api.post("/api/auth/password-reset/", { email_or_username: value.trim() });
      setOkMsg("If that account exists, we sent password reset instructions to the email.");
    } catch (e: unknown) {
      // Still show safe message if you prefer. For dev, show error.
      setErrMsg(parseError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        bgcolor: "#f6f7fb",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 440, borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Forgot password
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            Enter your username or email. We will send a reset link.
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {okMsg ? (
            <Alert severity="success" onClose={() => setOkMsg(null)} sx={{ mb: 2, borderRadius: 2 }}>
              {okMsg}
            </Alert>
          ) : null}

          {errMsg ? (
            <Alert severity="error" onClose={() => setErrMsg(null)} sx={{ mb: 2, borderRadius: 2 }}>
              {errMsg}
            </Alert>
          ) : null}

          <Stack spacing={2}>
            <TextField
              fullWidth
              autoFocus
              label="Username or email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
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
                  <span>Sending</span>
                </Stack>
              ) : (
                "Send reset link"
              )}
            </Button>

            <Link component={RouterLink} to="/login" underline="hover" sx={{ fontWeight: 700, fontSize: 13 }}>
              Back to sign in
            </Link>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
