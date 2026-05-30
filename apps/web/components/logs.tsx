"use client";

import { projectPreviewUrl } from "@/components/deployment-preview";
import React from "react";
import { PROJECTS_QUERY } from "@/lib/queries";
import type { DeploymentMetadata, LogEvent } from "@/lib/types";
import { env } from "@lite/env/client";
import { cn } from "@lite/ui/lib/utils";
import Ansi from "ansi-to-react";

type LogsProps = {
  projectSlug: string;
  deploymentId?: string;
  onDeploymentFinished?: () => void;
  embedded?: boolean;
};

const API_BASE_URL = `${env.NEXT_PUBLIC_BACKEND_URL}/api`;

export const Logs = ({
  projectSlug,
  deploymentId,
  onDeploymentFinished,
  embedded = false,
}: LogsProps) => {
  const logsTarget = deploymentId ?? projectSlug;
  const [logs, setLogs] = React.useState<LogEvent[]>([]);
  const [deployment, setDeployment] = React.useState<DeploymentMetadata>({});
  const [isConnected, setIsConnected] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const onFinishedRef = React.useRef(onDeploymentFinished);
  onFinishedRef.current = onDeploymentFinished;

  const isHealthy = deployment.status === "healthy";
  const isDeploying =
    deployment.status === "success" || deployment.status === "deploying";
  const liveDemoUrl = projectPreviewUrl(projectSlug);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [logs.length]);

  React.useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;
    let finishedNotified = false;

    const notifyFinished = () => {
      if (finishedNotified) return;
      finishedNotified = true;
      onFinishedRef.current?.();
    };

    setLogs([]);
    setDeployment({});
    setIsConnected(false);

    const hydrateAndStream = async () => {
      try {
        const initialData = await PROJECTS_QUERY.logs(logsTarget);
        if (!isMounted) return;

        setLogs(initialData.logs);
        setDeployment(initialData.deployment ?? {});

        const terminalStatuses = ["error", "failed", "healthy"];
        if (terminalStatuses.includes(initialData.deployment?.status ?? "")) {
          notifyFinished();
        }

        eventSource = new EventSource(
          `${API_BASE_URL}/projects/${logsTarget}/logs/stream`,
        );

        eventSource.addEventListener("connected", () => {
          if (!isMounted) return;
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
            notifyFinished();
          }
        });

        eventSource.addEventListener("done", () => {
          setIsConnected(false);
          eventSource?.close();
          notifyFinished();
        });

        eventSource.onerror = () => {
          if (!isMounted) return;
          setIsConnected(false);
        };
      } catch {
        if (!isMounted) return;
        setIsConnected(false);
      }
    };

    void hydrateAndStream();

    return () => {
      isMounted = false;
      eventSource?.close();
    };
  }, [logsTarget]);

  const logBody = (
    <>
      {!embedded && isDeploying && !isHealthy ? (
        <p className="m-4 mt-0 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Build finished. Starting runtime and waiting for health check…
        </p>
      ) : null}
      {!embedded && isHealthy ? (
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
      <div
        className={cn(
          "min-w-0 overflow-auto bg-background font-mono text-sm",
          embedded ? "max-h-[420px] px-4 pb-4 pt-2" : "max-h-[380px] rounded pb-4",
        )}
      >
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
                    <Ansi className="whitespace-pre font-mono">
                      {log.message}
                    </Ansi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={ref} />
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="w-full min-w-0">
        <div className="flex items-center justify-end gap-2 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span>status: {deployment.status ?? "pending"}</span>
          <span>·</span>
          <span>{isConnected ? "live" : "reconnecting"}</span>
        </div>
        {logBody}
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl min-w-0 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold">Build logs</h2>
        <div className="text-sm text-muted-foreground">
          status: {deployment.status ?? "pending"} |{" "}
          {isConnected ? "live" : "reconnecting"}
        </div>
      </div>
      {logBody}
    </div>
  );
};
