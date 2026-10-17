"use server";

import nodemailer from "nodemailer";
import { createSubmitContact, type ContactState, type OutgoingMail } from "@/lib/contact";

async function sendWithSmtp(mail: OutgoingMail): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !CONTACT_TO) {
    throw new Error("SMTP não configurado (SMTP_HOST, SMTP_USER, SMTP_PASS, CONTACT_TO)");
  }
  const port = Number(SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({
    from: `"Site Zemann" <${SMTP_USER}>`,
    to: CONTACT_TO,
    replyTo: mail.replyTo,
    subject: mail.subject,
    text: mail.text,
  });
}

const submit = createSubmitContact(sendWithSmtp);

export async function submitContact(prev: ContactState, formData: FormData): Promise<ContactState> {
  return submit(prev, formData);
}
