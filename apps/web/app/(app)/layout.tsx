import { SessionProvider } from "@/providers/session";
import { auth } from "@lite/auth/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import React from "react";

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/auth/login");

  return <SessionProvider session={session}>{children}</SessionProvider>;
};

export default AppLayout;
