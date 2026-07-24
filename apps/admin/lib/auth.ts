import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./supabase-server";

export type AdminSession = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  name: string;
  role: "admin" | "editor";
};

export const requireAdminSession = cache(async (): Promise<AdminSession> => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("admin_users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  return {
    supabase,
    userId: user.id,
    name: profile.name,
    role: profile.role as "admin" | "editor",
  };
});
