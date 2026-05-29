"use client";

import { PROJECTS_QUERY } from "@/lib/queries";
import { Button, buttonVariants } from "@lite/ui/components/button";
import { Icons } from "@lite/ui/components/icons";
import { Input } from "@lite/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "../header";
import { QUERY_KEYS } from "@/lib/consts";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

function formatRepoLabel(repoUrl: string) {
  try {
    const url = new URL(repoUrl);
    return url.pathname.replace(/^\//, "").replace(/\.git$/, "");
  } catch {
    return repoUrl;
  }
}

function projectSiteUrl(subDomain: string) {
  return `https://${subDomain}`;
}

export const App = () => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: [QUERY_KEYS.PROJECTS, page, debouncedSearch, PAGE_SIZE],
    queryFn: () =>
      PROJECTS_QUERY.list({
        page,
        limit: PAGE_SIZE,
        q: debouncedSearch || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const projects = data?.projects ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-10 flex flex-col gap-10">
        <div className="flex items-center justify-between gap-5">
          <div className="flex-1">
            <Input
              placeholder="Search projects"
              className="w-full"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Link href="/new" className={buttonVariants()}>
            Create Project
          </Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load projects"}
          </p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? "No projects match your search."
              : "No projects yet. Create your first project."}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => {
              const siteUrl = projectSiteUrl(project.subDomain);
              const projectHref = `/projects/${project.slug}`;

              return (
                <div
                  key={project.id}
                  className="rounded-lg p-4 border bg-input/30 flex flex-col justify-between gap-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between z-10">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-10 shrink-0 rounded-lg bg-primary/10" />
                      <div className="min-w-0">
                        <h3 className="text-base truncate">{project.name}</h3>
                        <Link
                          href={siteUrl}
                          className="text-sm text-muted-foreground hover:underline font-sans! truncate block"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {project.subDomain}
                        </Link>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative z-20 shrink-0"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreVertical />
                    </Button>
                  </div>
                  <div className="bg-muted rounded-full p-1 w-fit max-w-full flex items-center gap-2 pr-2 z-10">
                    <Icons.github className="size-4 shrink-0" />
                    <span className="text-xs truncate">
                      {formatRepoLabel(project.repoUrl)}
                    </span>
                  </div>
                  <div className="z-10">
                    <Link
                      href={projectHref}
                      className="text-sm hover:underline font-sans! line-clamp-2"
                    >
                      View project
                    </Link>
                  </div>
                  <Link
                    href={projectHref}
                    aria-label={`Open ${project.name}`}
                    className="absolute inset-0 z-0"
                  />
                </div>
              );
            })}
          </div>
        )}

        {pagination && pagination.total > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total}
              {isFetching && !isLoading ? " · Updating..." : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={!canGoPrevious || isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-24 text-center">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={!canGoNext || isFetching}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
