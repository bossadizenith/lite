"use client";

import { env } from "@lite/env/client";
import React from "react";
import { DeploymentMetadata, LogEvent, PROJECTS_QUERY } from "@/lib/queries";

type LogsProps = {
  deploymentId: string;
};

const API_BASE_URL = `${env.NEXT_PUBLIC_BACKEND_URL}/api`;

export const Logs = ({ deploymentId }: LogsProps) => {
  const [logs, setLogs] = React.useState<LogEvent[]>([]);
  const [deployment, setDeployment] = React.useState<DeploymentMetadata>({});
  const [isConnected, setIsConnected] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const isSuccess = deployment.status === "success";
  const liveDemoHost = `${deploymentId}.localhoststories.dev`;
  const liveDemoUrl = `https://${liveDemoHost}`;

  React.useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [logs.length]);

  // nothing for now

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

          const terminalStatuses = ["success", "error", "failed", "healthy"];
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
    <div className="w-full max-w-3xl rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Build logs</h2>
        <div className="text-sm text-muted-foreground">
          status: {deployment.status ?? "pending"} |{" "}
          {isConnected ? "live" : "reconnecting"}
        </div>
      </div>
      {isSuccess ? (
        <p className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
          Deployed live demo is on{" "}
          <a
            href={liveDemoUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            {liveDemoHost}
          </a>
        </p>
      ) : null}
      <div className="max-h-[380px] overflow-auto rounded bg-background p-3 font-mono text-sm text-white">
        {logs.length === 0 ? (
          <p className="text-zinc-400">No logs yet...</p>
        ) : (
          logs.map((log) => (
            <p key={log.id} className="wrap-break-words">
              [{new Date(log.timestamp).toLocaleTimeString()}] [{log.level}]{" "}
              {log.message}
            </p>
          ))
        )}
        <div ref={ref} />
      </div>
    </div>
  );
};
