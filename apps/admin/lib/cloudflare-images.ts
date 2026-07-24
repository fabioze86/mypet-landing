export async function uploadImageToCloudflare(file: File): Promise<{ url: string } | { error: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return { error: "Cloudflare Images não está configurado (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN)." };
  }

  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
    body,
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    console.error("[cloudflare-images] upload falhou:", JSON.stringify(json.errors ?? json));
    return { error: "Não foi possível enviar a imagem. Tente novamente." };
  }

  const url = json.result?.variants?.[0];
  if (!url) {
    return { error: "Upload concluído, mas nenhuma URL foi retornada." };
  }

  return { url };
}
