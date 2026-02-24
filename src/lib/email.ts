import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Escape HTML special characters to prevent injection */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendInviteEmail(email: string, token: string, inviterName: string) {
  const inviteUrl = `${APP_URL}/invite/${token}`;

  await resend.emails.send({
    from: `Aukcija <${process.env.EMAIL_FROM || "noreply@aukcija.rs"}>`,
    to: email,
    subject: "Pozivnica za Aukcija platformu",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Dobrodosli na Aukcija platformu!</h2>
        <p>${escapeHtml(inviterName)} vas je pozvao/la da se pridruzite platformi za aukcije vozila.</p>
        <p>Kliknite na link ispod da biste postavili lozinku i aktivirali nalog:</p>
        <a href="${inviteUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Aktiviraj nalog
        </a>
        <p style="color: #666; font-size: 14px;">Link istice za 48 sati.</p>
      </div>
    `,
  });
}

export async function sendAuctionWonEmail(email: string, auctionTitle: string, amount: string, currency: string) {
  await resend.emails.send({
    from: `Aukcija <${process.env.EMAIL_FROM || "noreply@aukcija.rs"}>`,
    to: email,
    subject: `Cestitamo! Pobedili ste na aukciji: ${escapeHtml(auctionTitle)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Cestitamo!</h2>
        <p>Vasa ponuda od <strong>${escapeHtml(amount)} ${escapeHtml(currency)}</strong> je pobedila na aukciji za <strong>${escapeHtml(auctionTitle)}</strong>.</p>
        <a href="${APP_URL}/won" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Pogledaj detalje
        </a>
      </div>
    `,
  });
}

export async function sendOutbidEmail(email: string, auctionTitle: string) {
  await resend.emails.send({
    from: `Aukcija <${process.env.EMAIL_FROM || "noreply@aukcija.rs"}>`,
    to: email,
    subject: `Pretekli su vas na aukciji: ${escapeHtml(auctionTitle)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Neko vas je pretekao!</h2>
        <p>Vasa ponuda na aukciji za <strong>${escapeHtml(auctionTitle)}</strong> vise nije najveca.</p>
        <a href="${APP_URL}/auctions" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Licitiraj ponovo
        </a>
      </div>
    `,
  });
}

export async function sendAuctionLostEmail(email: string, auctionTitle: string) {
  await resend.emails.send({
    from: `Aukcija <${process.env.EMAIL_FROM || "noreply@aukcija.rs"}>`,
    to: email,
    subject: `Aukcija zavrsena: ${escapeHtml(auctionTitle)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Aukcija je zavrsena</h2>
        <p>Nazalost, vasa ponuda na aukciji za <strong>${escapeHtml(auctionTitle)}</strong> nije bila dovoljno visoka.</p>
      </div>
    `,
  });
}
