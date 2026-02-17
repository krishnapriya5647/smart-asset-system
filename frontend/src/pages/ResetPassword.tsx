import { useMemo, useState } from "react";
import { Link as RouterLink, useParams, useNavigate } from "react-router-dom";
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
  Stack,
  TextField,
  Typography,
  Link,
} from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { api } from "../api/client";

function parseError(e: unknown) {
    const msg = "Could not reset password.";
  if (typeof e === "object" && e !== null) {
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

export default function ResetPassword() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [show, setShow] = useState(false);

  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!uid && !!token && p1.length >= 8 && p2.length >= 8 && p1 === p2 && !loading;
  }, [uid, token, p1, p2, loading]);

  async function submit() {
    if (!uid || !token || !canSubmit) return;
    setLoading(true);
    setOkMsg(null);
    setErrMsg(null);

    try {
      await api.post(`/api/auth/password-reset-confirm/${uid}/${token}/`, {
        new_password1: p1,
        new_password2: p2,
      });
      setOkMsg("Password updated. You can sign in now.");
      setTimeout(() => navigate("/login"), 800);
    } catch (e: unknown) {
      setErrMsg(parseError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "#f6f7fb" }}>
      <Card sx={{ width: "100%", maxWidth: 440, borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Reset password
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            Enter a new password (minimum 8 characters).
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
              label="New password"
              type={show ? "text" : "password"}
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShow((v) => !v)} edge="end">
                      {show ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Confirm new password"
              type={show ? "text" : "password"}
              value={p2}
              onChange={(e) => setP2(e.target.value)}
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
                  <span>Updating</span>
                </Stack>
              ) : (
                "Update password"
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
