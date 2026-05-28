"use client";

import { Header } from "../header";

export const App = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-10">
        <h1>App</h1>
      </main>
    </div>
  );
};
