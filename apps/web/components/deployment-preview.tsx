"use client";

const isDev = process.env.NODE_ENV === "development";

export function projectPreviewUrl(projectSlug: string) {
  return isDev
    ? `http://${projectSlug}.localhost:8000`
    : `https://${projectSlug}.localhoststories.dev`;
}
