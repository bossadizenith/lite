"use client";

import { env } from "@lite/env/client";
import React from "react";
import { DeploymentMetadata, LogEvent, PROJECTS_QUERY } from "@/lib/queries";
import { cn } from "@lite/ui/lib/utils";

type LogsProps = {
  deploymentId: string;
};

const API_BASE_URL = `${env.NEXT_PUBLIC_BACKEND_URL}/api`;
const isDev = process.env.NODE_ENV === "development";

export const Logs = ({ deploymentId }: LogsProps) => {
  const [logs, setLogs] = React.useState<LogEvent[]>([]);
  const [deployment, setDeployment] = React.useState<DeploymentMetadata>({});
  const [isConnected, setIsConnected] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const isHealthy = deployment.status === "healthy";
  const isDeploying =
    deployment.status === "success" || deployment.status === "deploying";
  const liveDemoHost = `${deploymentId}.localhoststories.dev`;
  const liveDemoUrl = isDev
    ? `http://${deploymentId}.localhost:8000`
    : `https://${liveDemoHost}`;

  React.useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [logs.length]);

  React.useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;

    const hydrateAndStream = async () => {
      try {
        const initialData = await PROJECTS_QUERY.logs(deploymentId);
        if (!isMounted) return;

        setLogs(initialData.logs);
        setDeployment(initialData.deployment ?? {});

        eventSource = new EventSource(
          `${API_BASE_URL}/projects/${deploymentId}/logs/stream`,
        );

        eventSource.addEventListener("connected", () => {
          setIsConnected(true);
        });

        eventSource.addEventListener("log", (event) => {
          const payload = JSON.parse((event as MessageEvent).data) as LogEvent;

          setLogs((prevLogs) => {
            if (prevLogs.some((log) => log.id === payload.id)) return prevLogs;
            return [...prevLogs, payload];
          });
        });

        eventSource.addEventListener("deployment", (event) => {
          const payload = JSON.parse((event as MessageEvent).data) as
            | DeploymentMetadata
            | undefined;
          if (!payload) return;
          setDeployment(payload);

          const terminalStatuses = ["error", "failed", "healthy"];
          if (terminalStatuses.includes(payload.status ?? "")) {
            setIsConnected(false);
            eventSource?.close();
          }
        });

        eventSource.addEventListener("done", () => {
          setIsConnected(false);
          eventSource?.close();
        });

        eventSource.onerror = () => {
          setIsConnected(false);
        };
      } catch {
        setIsConnected(false);
      }
    };

    hydrateAndStream();

    return () => {
      isMounted = false;
      eventSource?.close();
    };
  }, [deploymentId]);

  return (
    <div className="w-full max-w-3xl min-w-0 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold">Build logs</h2>
        <div className="text-sm text-muted-foreground">
          status: {deployment.status ?? "pending"} |{" "}
          {isConnected ? "live" : "reconnecting"}
        </div>
      </div>
      {isDeploying && !isHealthy ? (
        <p className="m-4 mt-0 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Build finished. Starting runtime and waiting for health check…
        </p>
      ) : null}
      {isHealthy ? (
        <p className="m-4 mt-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
          Deployed live demo is on{" "}
          <a
            href={liveDemoUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            {liveDemoUrl}
          </a>
        </p>
      ) : null}
      <div className="max-h-[380px] min-w-0 overflow-auto rounded bg-background font-mono text-sm pb-4">
        {logs.length === 0 ? (
          <p className="p-4 pt-0 text-zinc-400">No logs yet...</p>
        ) : (
          <table className="w-max min-w-full border-collapse">
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className={cn({
                    "bg-red-500/10 text-red-500": log.level === "error",
                    "bg-yellow-500/10 text-yellow-500": log.level === "warn",
                    // "bg-green-500/10 text-green-500": log.level === "success",
                  })}
                >
                  <td className="whitespace-pre px-4 py-0.5 align-top">
                    <span className="text-muted-foreground">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>{" "}
                    {log.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={ref} />
      </div>
    </div>
  );
};
