import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { ApiError, api } from "@/api/client";
import { keys, useMe } from "@/api/queries";
import { Wordmark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const me = useMe();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  if (me.isSuccess) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      client.setQueryData(keys.me, await api.login(username, password));
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shell aurora grid min-h-dvh grid-rows-[auto_1fr] text-foreground">
      <header className="px-6 py-5 sm:px-10">
        <Wordmark />
      </header>
      <main className="grid items-center px-6 pb-16 sm:px-10">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_380px]">
          <div className="max-w-xl">
            <h1 className="text-4xl leading-[1.1] font-light sm:text-5xl">See what people notice in your ad.</h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed font-light text-foreground/80">
              Build a study, show each person one version, and measure what they remember and how fast they find it.
            </p>
          </div>
          <form onSubmit={(event) => void submit(event)} className="border border-shell-line bg-shell/85 p-6 sm:p-7">
            <h2 className="text-xl font-light">Log in</h2>
            <div className="mt-5 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
                {isSubmitting ? "Logging in…" : "Log in"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
