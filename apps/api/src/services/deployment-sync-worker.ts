import { db } from "@lite/db";
import { syncActiveDeployments } from "./deployment-pipeline.js";

const SYNC_INTERVAL_MS = 2000;

export function startDeploymentSyncWorker() {
  const tick = async () => {
    try {
      await syncActiveDeployments(db);
    } catch (error) {
      console.error("[deployment-sync] tick failed:", error);
    }
  };

  void tick();
  const interval = setInterval(() => {
    void tick();
  }, SYNC_INTERVAL_MS);

  if (typeof interval.unref === "function") {
    interval.unref();
  }
}
