import { apiClient } from "./api-client";
import { CreateProjectSchema } from "./schema";

export const PROJECTS_QUERY = {
  create: async (data: CreateProjectSchema) => {
    const response = await apiClient.post("/projects", data);
    return response;
  },
};
