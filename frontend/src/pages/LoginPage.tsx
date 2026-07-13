import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import { useAuth } from "../auth/AuthContext";
import { EPIROC_BLACK, EPIROC_YELLOW } from "../theme/epirocBrand";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: 380 }} elevation={3}>
        <CardContent component="form" onSubmit={handleSubmit} sx={{ p: 4 }}>
          <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <Avatar sx={{ bgcolor: EPIROC_BLACK, width: 48, height: 48 }}>
              <WorkOutlineIcon sx={{ color: EPIROC_YELLOW }} />
            </Avatar>
            <Typography variant="h6" fontWeight={700}>
              Job Lifecycle Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to continue
            </Typography>
          </Stack>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
