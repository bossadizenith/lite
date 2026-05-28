"use client";

import { useSession } from "@/providers/session";
import Link from "next/link";
import { UserButton } from "@lite/ui/components/user-button";

export const Header = () => {
  const { user } = useSession();
  return (
    <header className="border-b sticky top-0 z-10 h-16 flex items-center justify-between bg-background">
      <nav className="container flex items-center justify-between">
        <Link href="/" className="font-semibold">
          lite.
        </Link>
        <UserButton name={user.name} url={user?.image} />
      </nav>
    </header>
  );
};
