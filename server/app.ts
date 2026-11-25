import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import type { Server } from "http";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson as Record<string, unknown>;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Register routes and static serving synchronously so default export is ready for main-server
void registerRoutes(undefined as unknown as Server, app);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT") {
    res.status(503).json({ code: "ENOENT", message: "Server maintenance, back shortly" });
    return;
  }
  const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode ?? 500;
  const message = (err as Error).message ?? "Internal Server Error";

  res.status(status).json({ message });
});

serveStatic(app);

/** Optional async init (e.g. for DB); for main-server we use the default export which is already configured. */
export async function initializeApp(httpServer?: Server) {
  await registerRoutes(httpServer ?? ({} as Server), app);
  serveStatic(app);
  return app;
}

export default app;
