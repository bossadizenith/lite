"use client";

import { type Session } from "@lite/auth/auth";
import { type PropsWithChildren, useContext, createContext } from "react";

type SessionContextType = Session;

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({
  session,
  children,
}: PropsWithChildren<{ session: Session }>) => {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("Session not found");
  }
  return session;
};
