"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: habits, error } = await supabase
        .from("habits")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (error) {
        console.error(error);
        router.replace("/onboarding");
        return;
      }

      router.replace((habits?.length ?? 0) > 0 ? "/dashboard" : "/onboarding");
    })();
  }, [router]);

  return <div className="min-h-screen p-8 text-white/70">Loading...</div>;
}