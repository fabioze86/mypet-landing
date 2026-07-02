import { google } from "googleapis";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { nome, empresa, whatsapp, cnpj } = await req.json();

  if (!nome || !empresa || !whatsapp) {
    return Response.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Leads!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[new Date().toLocaleString("pt-BR"), nome, empresa, whatsapp, cnpj || ""]],
    },
  });

  return Response.json({ ok: true });
}
