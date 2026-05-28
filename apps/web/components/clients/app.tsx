"use client";

import { Button } from "@lite/ui/components/button";
import { Header } from "../header";
import { Input } from "@lite/ui/components/input";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { Icons } from "@lite/ui/components/icons";

export const App = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-10 flex flex-col gap-10">
        <div className="flex items-center justify-between gap-5">
          <div className="flex-1">
            <Input placeholder="Search projects" className="w-full" />
          </div>
          <Button>Create Project</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg p-4 border bg-input/30 flex flex-col justify-between gap-2 relative overflow-hidden"
            >
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="size-10 rounded-lg bg-primary/10"></div>
                  <div>
                    <h3 className="text-base">Project {index + 1}</h3>
                    <Link
                      href={`https://nothing.localhoststories.dev`}
                      className="text-sm text-muted-foreground hover:underline font-sans!"
                      target="_blank"
                    >
                      nothing.localhoststories.dev
                    </Link>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical />
                </Button>
              </div>
              <div className="bg-muted rounded-full p-1 w-fit flex items-center gap-2 pr-2 z-10">
                <Icons.github className="size-4" />
                <span className="text-xs">username/repo</span>
              </div>
              <div className="z-10">
                <Link
                  href={`/projects/${index + 1}`}
                  className="text-sm  hover:underline font-sans! line-clamp-1"
                >
                  View Project nothing is working on nothing Lorem ipsum dolor
                  sit amet consectetur adipisicing elit. Voluptate sint omnis
                </Link>
              </div>
              <Link
                href={`/projects/${index + 1}`}
                className="absolute inset-0"
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

{
  /*

    <a data-zone="same" class="link-module__Q1NRQq__link no-underline absolute inset-0" href="/bossadizenith/snips"></a>
    */
}
