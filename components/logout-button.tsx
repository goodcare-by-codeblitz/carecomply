"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await fetch('/auth/logout', { method: 'POST' });
    router.push("/auth/login");
    router.refresh();
  };

  return <Button onClick={logout}>Logout</Button>;
}
