import { Project } from "next/dist/build/swc/types";
import { apiClient } from "./api-client";

export const PROJECTS_QUERY = {
  create: async (repoUrl: string) => {
    const response = await apiClient.post("/projects", repoUrl);
    return response;
  },
};
