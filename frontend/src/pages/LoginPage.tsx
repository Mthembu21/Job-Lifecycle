import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Alert, Button, Logo, TextField } from "../components/ui";

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
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err && err.response && typeof err.response === "object" && "data" in err.response
          ? (err.response as { data?: { error?: string } }).data?.error
          : undefined;
      setError(message ?? "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex flex-col items-center gap-5 border-b-4 border-yellow px-8 pt-9 pb-7">
          <Logo className="h-10" />
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">Job Lifecycle Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to continue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-8 py-7">
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" size="lg" loading={submitting} className="mt-1 w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
