import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const EMAIL_FROM = `Premium Garaza <${process.env.EMAIL_FROM || "noreply@aukcija.maconi.rs"}>`;

/** Escape HTML special characters to prevent injection */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Shared email wrapper with Premium Garaza branding */
function emailLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="sr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="vertical-align:middle;padding-right:12px;">
                <div style="width:44px;height:44px;background:#d4a843;border-radius:10px;display:inline-block;text-align:center;line-height:44px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#1a1a2e;">PG</div>
              </td>
              <td style="vertical-align:middle;">
                <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Premium Garaza</span>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Content -->
        <tr><td style="background-color:#ffffff;padding:40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background-color:#fafafa;padding:24px 40px;border-radius:0 0 12px 12px;border:1px solid #e4e4e7;border-top:none;text-align:center;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">
            &copy; ${new Date().getFullYear()} Premium Garaza &middot; Platforma za aukcije vozila
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">
            <a href="${APP_URL}" style="color:#d4a843;text-decoration:none;">premiumgaraza.rs</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Gold accent button */
function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background-color:#d4a843;border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:14px 32px;color:#1a1a2e;font-weight:600;font-size:15px;text-decoration:none;letter-spacing:0.3px;">${label}</a>
    </td></tr>
  </table>`;
}

export async function sendInviteEmail(email: string, token: string, inviterName: string) {
  const inviteUrl = `${APP_URL}/invite/${token}`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Pozivnica za Premium Garaza platformu",
    html: emailLayout(`
      <h1 style="margin:0 0 16px;font-size:24px;color:#1a1a2e;">Dobrodosli!</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
        <strong>${escapeHtml(inviterName)}</strong> vas poziva da se pridruzite
        <strong>Premium Garaza</strong> platformi za aukcije premium vozila.
      </p>
      <p style="margin:0 0 4px;font-size:15px;color:#3f3f46;line-height:1.6;">
        Kliknite na dugme ispod da postavite lozinku i aktivirate nalog:
      </p>
      ${emailButton(inviteUrl, "Aktiviraj nalog")}
      <p style="margin:0;font-size:13px;color:#a1a1aa;">Link istice za 48 sati.</p>
    `),
  });
}

export async function sendAuctionWonEmail(email: string, auctionTitle: string, amount: string, currency: string) {
  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Cestitamo! Pobedili ste na aukciji: ${escapeHtml(auctionTitle)}`,
    html: emailLayout(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:64px;height:64px;background:#ecfdf5;border-radius:50%;line-height:64px;font-size:32px;">&#127942;</div>
      </div>
      <h1 style="margin:0 0 16px;font-size:24px;color:#1a1a2e;text-align:center;">Cestitamo!</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;text-align:center;">
        Vasa ponuda je pobedila na aukciji za:
      </p>
      <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:20px;margin:16px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a2e;">${escapeHtml(auctionTitle)}</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#d4a843;">${escapeHtml(amount)} ${escapeHtml(currency)}</p>
      </div>
      <div style="text-align:center;">
        ${emailButton(`${APP_URL}/won`, "Pogledaj detalje")}
      </div>
    `),
  });
}

export async function sendNewAuctionEmail(auctionTitle: string, auctionId: string, endTime: Date, currency: string, startingPrice?: string | null) {
  // Fetch all active buyers
  const buyers = await prisma.user.findMany({
    where: { role: "BUYER", status: "ACTIVE" },
    select: { email: true },
  });

  if (buyers.length === 0) return;

  const auctionUrl = `${APP_URL}/auctions/${auctionId}`;
  const formattedEnd = endTime.toLocaleDateString("sr-RS", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const priceLine = startingPrice
    ? `<p style="margin:0;font-size:15px;color:#3f3f46;">Pocetna cena: <strong>${escapeHtml(startingPrice)} ${escapeHtml(currency)}</strong></p>`
    : "";

  const html = emailLayout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#fef3c7;border-radius:50%;line-height:64px;font-size:32px;">&#128663;</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;color:#1a1a2e;text-align:center;">Nova aukcija!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;text-align:center;">
      Upravo je pocela nova aukcija na Premium Garaza platformi:
    </p>
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:20px;margin:16px 0;text-align:center;">
      <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a2e;">${escapeHtml(auctionTitle)}</p>
      ${priceLine}
      <p style="margin:8px 0 0;font-size:13px;color:#a1a1aa;">Zavrsava se: ${escapeHtml(formattedEnd)}</p>
    </div>
    <div style="text-align:center;">
      ${emailButton(auctionUrl, "Pogledaj aukciju")}
    </div>
  `);

  // Send to all buyers in parallel (batch of emails)
  await Promise.all(
    buyers.map((buyer) =>
      resend.emails.send({
        from: EMAIL_FROM,
        to: buyer.email,
        subject: `Nova aukcija: ${escapeHtml(auctionTitle)}`,
        html,
      }).catch(() => {})
    )
  );
}
