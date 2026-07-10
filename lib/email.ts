// Thin wrapper over the Resend HTTP API for transactional email.
//
// Sending is best-effort: callers should treat a false return as "email didn't
// go out" and fall back to showing a copyable link, never blocking the action.
//
// IMPORTANT: Resend only delivers to arbitrary recipients once a sending domain
// is verified (Resend → Domains). With the default onboarding@resend.dev sender
// and no verified domain, delivery is limited to the account owner's address.
// Set RESEND_FROM to an address on your verified domain for real delivery.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  const from = process.env.RESEND_FROM || "Klovered <onboarding@resend.dev>";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.message || `Resend ${res.status}` };
    }
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

// ─── Templates ─────────────────────────────────────────────────────────────

const WRAP = (inner: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
  <div style="font-weight:700;font-size:18px;letter-spacing:-0.02em;margin-bottom:24px;">Klovered</div>
  ${inner}
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;" />
  <div style="font-size:12px;color:#888;">If you weren't expecting this email, you can safely ignore it.</div>
</div>`;

const BTN = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#1f6f43;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:6px;margin:8px 0 16px;">${label}</a>`;

export function inviteEmail(opts: {
  orgName: string;
  role: string;
  inviterName?: string | null;
  acceptUrl: string;
}): { subject: string; html: string; text: string } {
  const by = opts.inviterName ? `${opts.inviterName} invited you` : "You've been invited";
  return {
    subject: `Join ${opts.orgName} on Klovered`,
    html: WRAP(`
      <p style="font-size:15px;line-height:1.5;margin:0 0 4px;">${by} to join <strong>${opts.orgName}</strong> as <strong>${opts.role}</strong>.</p>
      <p style="font-size:14px;color:#555;margin:0 0 8px;">Click below to accept and set up your account.</p>
      ${BTN(opts.acceptUrl, "Accept invite")}
      <p style="font-size:12px;color:#888;word-break:break-all;">Or paste this link: ${opts.acceptUrl}</p>
    `),
    text: `${by} to join ${opts.orgName} as ${opts.role}.\n\nAccept: ${opts.acceptUrl}`,
  };
}

export function resetEmail(opts: { resetUrl: string }): { subject: string; html: string; text: string } {
  return {
    subject: "Reset your Klovered password",
    html: WRAP(`
      <p style="font-size:15px;line-height:1.5;margin:0 0 4px;">We received a request to reset your password.</p>
      <p style="font-size:14px;color:#555;margin:0 0 8px;">Click below to choose a new one. This link expires in 1 hour.</p>
      ${BTN(opts.resetUrl, "Reset password")}
      <p style="font-size:12px;color:#888;word-break:break-all;">Or paste this link: ${opts.resetUrl}</p>
    `),
    text: `Reset your Klovered password:\n\n${opts.resetUrl}`,
  };
}
