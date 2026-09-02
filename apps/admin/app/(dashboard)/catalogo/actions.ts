"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";

export async function refreshDistribuidoraCatalog(): Promise<void> {
  await requireAdminSession();

  const url = process.env.DISTRIBUIDORA_REVALIDATE_URL;
  const secret = process.env.CATALOG_REVALIDATE_SECRET;
  if (!url || !secret) {
    redirect("/catalogo?error=configuracao");
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[admin/catalogo] falha ao atualizar cache:", response.status);
      redirect("/catalogo?error=atualizacao");
    }
  } catch (error) {
    console.error("[admin/catalogo] falha ao acessar a distribuidora:", error);
    redirect("/catalogo?error=atualizacao");
  }

  redirect("/catalogo?updated=1");
}
