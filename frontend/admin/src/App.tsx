import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { ApiError, watchSignedOut } from "./api/client";
import { keys, useMe } from "./api/queries";
import { AppShell } from "./components/app-shell";
import { EditorPage } from "./pages/editor-page";
import { ImagesPage } from "./pages/images-page";
import { LoginPage } from "./pages/login-page";
import { SettingsPage } from "./pages/settings-page";
import { StudiesPage } from "./pages/studies-page";

/** Sends the admin to the login screen whenever the server says the session has ended. */
function useSignedOutRedirect(): void {
  const navigate = useNavigate();
  const client = useQueryClient();
  useEffect(() => {
    watchSignedOut(() => {
      client.setQueryData(keys.me, undefined);
      navigate("/login", { replace: true });
    });
  }, [client, navigate]);
}

function Protected() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <div className="shell min-h-dvh bg-shell" />;
  if (me.isError) {
    const isSignedOut = me.error instanceof ApiError && me.error.status === 401;
    if (isSignedOut) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return (
      <div className="shell grid min-h-dvh place-items-center bg-shell p-6 text-center text-foreground">
        <p>Could not reach the server. Check your connection and reload the page.</p>
      </div>
    );
  }
  return <AppShell username={me.data.username} />;
}

export function App() {
  useSignedOutRedirect();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route index element={<StudiesPage />} />
        <Route path="studies/:formId" element={<EditorPage tab="build" />} />
        <Route path="studies/:formId/responses" element={<EditorPage tab="responses" />} />
        <Route path="images" element={<ImagesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
