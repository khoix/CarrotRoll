import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { api, buildUrl } from "@shared/routes";
import type { HighScore } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowUpDown, ArrowUp, ArrowDown, Menu, KeyRound, LayoutDashboard, Gamepad2, Film, Smartphone } from "lucide-react";
import AdminDemo from "@/pages/AdminDemo";
import AdminEndingDemo from "@/pages/AdminEndingDemo";
import AdminEndingDemoMobile from "@/pages/AdminEndingDemoMobile";
import { useSound } from "@/contexts/SoundContext";

type SortKey = "id" | "name" | "score" | "level" | "device" | "createdAt";
type SortDir = "asc" | "desc";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

function adminFetch(path: string, options: RequestInit = {}) {
  return fetch(apiBase + path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
}

export default function AdminRoll() {
  const [location, setLocation] = useLocation();
  const { unlockAudio } = useSound();
  const [auth, setAuth] = useState<boolean | null>(null);
  const [scores, setScores] = useState<HighScore[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<Pick<HighScore, "name" | "score" | "level" | "device">>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [changePwError, setChangePwError] = useState<string | null>(null);
  const [changePwSuccess, setChangePwSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePwOpen, setChangePwOpen] = useState(false);

  const sortedScores = useMemo(() => {
    const list = [...scores];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "id":
          cmp = a.id - b.id;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "score":
          cmp = a.score - b.score;
          break;
        case "level":
          cmp = a.level - b.level;
          break;
        case "device":
          cmp = a.device.localeCompare(b.device);
          break;
        case "createdAt":
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [scores, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "score" || key === "level" || key === "id" ? "desc" : "asc");
      return key;
    });
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5" />
    );
  };

  const loadScores = useCallback(async () => {
    const res = await adminFetch(api.admin.scores.list.path);
    if (res.status === 401) {
      setAuth(false);
      setScores([]);
      return;
    }
    if (!res.ok) throw new Error("Failed to load scores");
    const data = await res.json();
    setScores(api.admin.scores.list.responses[200].parse(data));
    setAuth(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const checkRes = await adminFetch(api.admin.check.path);
        if (cancelled) return;
        if (!checkRes.ok) {
          setAuth(false);
          setScores([]);
          return;
        }
        const checkData = api.admin.check.responses[200].parse(await checkRes.json());
        if (!checkData.authenticated) {
          setAuth(false);
          setScores([]);
          return;
        }
        setAuth(true);
        const res = await adminFetch(api.admin.scores.list.path);
        if (cancelled) return;
        if (res.status === 401) {
          setAuth(false);
          setScores([]);
          return;
        }
        if (!res.ok) throw new Error("Failed to load scores");
        const data = await res.json();
        setScores(api.admin.scores.list.responses[200].parse(data));
      } catch {
        if (!cancelled) setAuth(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const res = await adminFetch(api.admin.login.path, {
      method: api.admin.login.method,
      body: JSON.stringify(api.admin.login.input.parse({ username, password })),
    });
    if (res.status === 401) {
      setLoginError("Invalid username or password");
      return;
    }
    if (!res.ok) {
      setLoginError("Login failed");
      return;
    }
    await loadScores();
  };

  const startEdit = (row: HighScore) => {
    setEditingId(row.id);
    setEditRow({ name: row.name, score: row.score, level: row.level, device: row.device });
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRow({});
    setSaveError(null);
  };

  const handleDelete = async (row: HighScore) => {
    if (!window.confirm(`Delete score from "${row.name}" (ID ${row.id})?`)) return;
    setDeleteError(null);
    const res = await adminFetch(buildUrl(api.admin.scores.delete.path, { id: row.id }), {
      method: api.admin.scores.delete.method,
    });
    if (res.status === 404) {
      setDeleteError("Score not found");
      return;
    }
    if (!res.ok) {
      setDeleteError("Failed to delete");
      return;
    }
    setScores((prev) => prev.filter((s) => s.id !== row.id));
    if (editingId === row.id) {
      setEditingId(null);
      setEditRow({});
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setChangePwError(null);
    setChangePwSuccess(false);
    if (newPassword !== confirmPassword) {
      setChangePwError("New password and confirmation do not match");
      return;
    }
    try {
      const body = api.admin.changePassword.input.parse({
        currentPassword,
        newPassword,
      });
      const res = await adminFetch(api.admin.changePassword.path, {
        method: api.admin.changePassword.method,
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        setChangePwError((data as { message?: string }).message || "Current password is incorrect");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChangePwError((data as { message?: string }).message || "Failed to change password");
        return;
      }
      setChangePwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePwOpen(false);
    } catch (err) {
      setChangePwError(err instanceof Error ? err.message : "Validation failed");
    }
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    setSaveError(null);
    try {
      const body = api.admin.scores.update.input.parse(editRow);
      const res = await adminFetch(buildUrl(api.admin.scores.update.path, { id: editingId }), {
        method: api.admin.scores.update.method,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError((data as { message?: string }).message || "Save failed");
        return;
      }
      const updated = api.admin.scores.update.responses[200].parse(await res.json());
      setScores((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingId(null);
      setEditRow({});
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  if (loading) {
    return (
      <div className="admin-page min-h-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4 safe-area-pad">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (auth === false) {
    return (
      <div className="admin-page admin-login min-h-screen min-h-[100dvh] flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white p-4 safe-area-pad">
        <Card className="w-full max-w-sm min-w-0 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] bg-white mx-auto">
          <CardHeader className="px-4 pt-6 pb-2 sm:px-6 sm:pt-8">
            <CardTitle className="font-display text-xl sm:text-2xl text-gray-900">Admin login</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-6 sm:px-6 sm:pb-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="min-h-11 text-base touch-manipulation rounded-xl border-2 border-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="min-h-11 text-base touch-manipulation rounded-xl border-2 border-black"
                />
              </div>
              {loginError && <p className="text-sm text-red-600">{loginError}</p>}
              <Button type="submit" className="w-full min-h-12 text-base touch-manipulation rounded-xl border-2 border-black bg-primary hover:bg-orange-600 text-white">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated: show hub, scores, demo, or ending-demo by path
  const isHub = location === "/adminroll" || location === "/adminroll/";
  if (auth && isHub) {
    return (
      <div className="admin-page min-h-screen min-h-[100dvh] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white p-4 safe-area-pad overflow-auto">
        <header className="flex items-center justify-end gap-2 mb-6 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Open menu"
                className="h-11 w-11 rounded-xl border-2 border-black bg-white shadow-md hover:bg-orange-50 touch-manipulation shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-2 border-black shadow-lg touch-manipulation">
              <DropdownMenuItem
                onClick={() => setChangePwOpen(true)}
                className="min-h-11 text-base py-3 cursor-pointer"
              >
                <KeyRound className="mr-2 h-4 w-4 shrink-0" />
                Change password
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <div className="flex-1 flex items-center justify-center min-w-0">
          <div className="max-w-3xl w-full min-w-0">
            <h1 className="font-display text-3xl font-bold text-gray-900 text-center mb-8">Admin</h1>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                className="h-auto min-w-0 w-full flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:bg-orange-50 active:bg-orange-100 transition-colors touch-manipulation"
                onClick={() => { unlockAudio(); setLocation("/adminroll/scores"); }}
              >
                <LayoutDashboard className="h-10 w-10 shrink-0 text-primary" />
                <span className="font-display font-semibold text-lg text-gray-900">Score Manager</span>
              </button>
              <button
                type="button"
                className="h-auto min-w-0 w-full flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:bg-orange-50 active:bg-orange-100 transition-colors touch-manipulation"
                onClick={() => setLocation("/adminroll/demo")}
              >
                <Gamepad2 className="h-10 w-10 shrink-0 text-primary" />
                <span className="font-display font-semibold text-lg text-gray-900">Demo Page</span>
              </button>
              <button
                type="button"
                className="h-auto min-w-0 w-full flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:bg-orange-50 active:bg-orange-100 transition-colors touch-manipulation"
                onClick={() => { unlockAudio(); setLocation("/adminroll/ending-demo"); }}
              >
                <Film className="h-10 w-10 shrink-0 text-primary" />
                <span className="font-display font-semibold text-lg text-gray-900">Ending Sequence Demo</span>
              </button>
              <button
                type="button"
                className="h-auto min-w-0 w-full flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:bg-orange-50 active:bg-orange-100 transition-colors touch-manipulation"
                onClick={() => { unlockAudio(); setLocation("/adminroll/ending-demo-mobile"); }}
              >
                <Smartphone className="h-10 w-10 shrink-0 text-primary" />
                <span className="font-display font-semibold text-lg text-gray-900">Ending Sequence Demo (Mobile)</span>
              </button>
            </div>
          </div>
        </div>
        <Dialog
          open={changePwOpen}
          onOpenChange={(open) => {
            setChangePwOpen(open);
            if (!open) {
              setChangePwError(null);
              setChangePwSuccess(false);
            }
          }}
        >
          <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-4 sm:mx-0 sm:max-w-md p-4 sm:p-6 top-[50%] max-h-[90dvh] overflow-y-auto safe-area-dialog rounded-2xl border-2 border-black shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-display">Change password</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hub-current-password">Current password</Label>
                <Input
                  id="hub-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="min-h-11 text-base touch-manipulation rounded-xl border-2 border-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-new-password">New password (min 8 characters)</Label>
                <Input
                  id="hub-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  className="min-h-11 text-base touch-manipulation rounded-xl border-2 border-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-confirm-password">Confirm new password</Label>
                <Input
                  id="hub-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  className="min-h-11 text-base touch-manipulation rounded-xl border-2 border-black"
                />
              </div>
              {changePwError && (
                <p className="text-sm text-red-600">{changePwError}</p>
              )}
              {changePwSuccess && (
                <p className="text-sm text-green-600">Password updated.</p>
              )}
              <Button type="submit" className="min-h-11 w-full sm:w-auto text-base touch-manipulation rounded-xl border-2 border-black">
                Change password
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  if (auth && location === "/adminroll/demo") {
    return <AdminDemo onBackToAdmin={() => setLocation("/adminroll")} />;
  }
  if (auth && location === "/adminroll/ending-demo") {
    return <AdminEndingDemo onBackToAdmin={() => setLocation("/adminroll")} />;
  }
  if (auth && location === "/adminroll/ending-demo-mobile") {
    return <AdminEndingDemoMobile onBackToAdmin={() => setLocation("/adminroll")} />;
  }

  const formatDate = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleString();
  };

  // Scores view (default when auth and on /adminroll/scores or legacy path)
  return (
    <div className="admin-page min-h-screen min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white p-4 md:p-8 safe-area-pad overflow-auto flex flex-col justify-center">
      <div className="max-w-6xl mx-auto min-w-0 w-full">
        <header className="flex flex-wrap items-center gap-3 mb-4 min-w-0">
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 touch-manipulation rounded-xl border-2 border-black bg-white hover:bg-orange-50"
            onClick={() => setLocation("/adminroll")}
          >
            Back to Admin
          </Button>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-gray-900 break-words min-w-0">Admin – Scores</h1>
        </header>
        {(saveError || deleteError) && (
          <p className="mb-2 text-sm text-red-600 bg-red-50 p-2 rounded-xl border-2 border-red-200">{saveError ?? deleteError}</p>
        )}
        <Card className="border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] min-w-0 w-full overflow-hidden">
          <div className="overflow-x-auto admin-table-scroll min-w-0 w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 shrink-0 align-middle">
                    <button
                      type="button"
                      onClick={() => handleSort("id")}
                      className="flex items-center font-medium hover:underline focus:outline-none focus:underline min-h-10 touch-manipulation py-2"
                    >
                      ID
                      <SortIcon column="id" />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-0 max-w-[12rem] align-middle">
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="flex items-center font-medium hover:underline focus:outline-none focus:underline min-h-10 touch-manipulation py-2 break-words text-left w-full"
                    >
                      Name
                      <SortIcon column="name" />
                    </button>
                  </TableHead>
                  <TableHead className="w-20 shrink-0 align-middle">
                    <button
                      type="button"
                      onClick={() => handleSort("score")}
                      className="flex items-center font-medium hover:underline focus:outline-none focus:underline min-h-10 touch-manipulation py-2"
                    >
                      Score
                      <SortIcon column="score" />
                    </button>
                  </TableHead>
                  <TableHead className="w-16 shrink-0 align-middle">
                    <button
                      type="button"
                      onClick={() => handleSort("level")}
                      className="flex items-center font-medium hover:underline focus:outline-none focus:underline min-h-10 touch-manipulation py-2"
                    >
                      Level
                      <SortIcon column="level" />
                    </button>
                  </TableHead>
                  <TableHead className="w-24 shrink-0 align-middle">
                    <button
                      type="button"
                      onClick={() => handleSort("device")}
                      className="flex items-center font-medium hover:underline focus:outline-none focus:underline min-h-10 touch-manipulation py-2"
                    >
                      Device
                      <SortIcon column="device" />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-0 max-w-[11rem] align-middle">
                    <button
                      type="button"
                      onClick={() => handleSort("createdAt")}
                      className="flex items-center font-medium hover:underline focus:outline-none focus:underline min-h-10 touch-manipulation py-2 break-words text-left w-full"
                    >
                      Created
                      <SortIcon column="createdAt" />
                    </button>
                  </TableHead>
                  <TableHead className="w-36 min-w-[8rem] shrink-0 align-middle">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedScores.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs align-middle py-2">{row.id}</TableCell>
                    {editingId === row.id ? (
                      <>
                        <TableCell className="min-w-0 max-w-[12rem] align-middle py-2">
                          <Input
                            value={editRow.name ?? ""}
                            onChange={(e) => setEditRow((p) => ({ ...p, name: e.target.value }))}
                            className="min-h-9 sm:h-8 w-full max-w-full touch-manipulation box-border"
                          />
                        </TableCell>
                        <TableCell className="align-middle py-2">
                          <Input
                            type="number"
                            value={editRow.score ?? ""}
                            onChange={(e) =>
                              setEditRow((p) => ({ ...p, score: parseInt(e.target.value, 10) || 0 }))
                            }
                            className="min-h-9 sm:h-8 w-20 touch-manipulation"
                          />
                        </TableCell>
                        <TableCell className="align-middle py-2">
                          <Input
                            type="number"
                            value={editRow.level ?? ""}
                            onChange={(e) =>
                              setEditRow((p) => ({ ...p, level: parseInt(e.target.value, 10) || 1 }))
                            }
                            className="min-h-9 sm:h-8 w-16 touch-manipulation"
                          />
                        </TableCell>
                        <TableCell className="align-middle py-2">
                          <select
                            value={editRow.device ?? "unknown"}
                            onChange={(e) =>
                              setEditRow((p) => ({
                                ...p,
                                device: e.target.value as "mobile" | "web" | "unknown",
                              }))
                            }
                            className="min-h-9 sm:h-8 rounded border border-input bg-background px-2 text-sm touch-manipulation"
                          >
                            <option value="web">web</option>
                            <option value="mobile">mobile</option>
                            <option value="unknown">unknown</option>
                          </select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs align-middle py-2">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell className="min-w-0 align-middle py-2 whitespace-nowrap">
                          <div className="flex gap-2 flex-nowrap min-w-0">
                            <Button size="sm" variant="default" onClick={saveEdit} className="min-h-9 min-w-14 touch-manipulation shrink-0">
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit} className="min-h-9 min-w-14 touch-manipulation shrink-0">
                              Cancel
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(row)} className="min-h-9 min-w-14 touch-manipulation shrink-0">
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="min-w-0 max-w-[12rem] break-words align-middle py-2">{row.name}</TableCell>
                        <TableCell className="whitespace-nowrap align-middle py-2">{row.score}</TableCell>
                        <TableCell className="whitespace-nowrap align-middle py-2">{row.level}</TableCell>
                        <TableCell className="whitespace-nowrap align-middle py-2">{row.device}</TableCell>
                        <TableCell className="text-muted-foreground text-xs break-words min-w-0 max-w-[11rem] align-middle py-2">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell className="min-w-0 align-middle py-2 whitespace-nowrap">
                          <div className="flex gap-2 flex-nowrap min-w-0">
                            <Button size="sm" variant="outline" onClick={() => startEdit(row)} className="min-h-9 min-w-14 touch-manipulation shrink-0">
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(row)} className="min-h-9 min-w-14 touch-manipulation shrink-0">
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {sortedScores.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No scores yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
