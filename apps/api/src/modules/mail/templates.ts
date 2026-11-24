/** Plain, email-client-safe HTML templates. Every interpolated value is escaped. */

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, body: string, footer = 'You are receiving this email because of your HisabKhata account.') {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f1e3d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e8ef;border-radius:8px">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e3e8ef;font-weight:700;font-size:16px">Hisab<span style="color:#059669;font-weight:500">Khata</span></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-size:18px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e3e8ef;color:#64748b;font-size:12px">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6">${t}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#0f1e3d;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600">${esc(label)}</a></p>
   <p style="margin:0 0 14px;font-size:12px;color:#64748b;word-break:break-all">Or open: ${esc(href)}</p>`;

export type TemplateName =
  | 'welcome'
  | 'verify-email'
  | 'password-reset'
  | 'invite'
  | 'invoice'
  | 'low-stock'
  | 'subscription-expiring'
  | 'payment-confirmation';

export function render(template: TemplateName, d: Record<string, any>): { subject: string; html: string; text: string } {
  switch (template) {
    case 'welcome':
      return {
        subject: 'Welcome to HisabKhata',
        html: layout(
          `Welcome, ${d.name}`,
          p(`Your business <strong>${esc(d.businessName)}</strong> is ready. Add your products, record a first sale, and your dashboard fills in from there.`) +
            button(`${d.appUrl}/dashboard`, 'Open dashboard'),
        ),
        text: `Welcome to HisabKhata, ${d.name}. Open ${d.appUrl}/dashboard`,
      };
    case 'verify-email':
      return {
        subject: 'Confirm your email address',
        html: layout('Confirm your email', p('Please confirm this is your email address. The link is valid for 24 hours.') + button(d.link, 'Confirm email')),
        text: `Confirm your email: ${d.link}`,
      };
    case 'password-reset':
      return {
        subject: 'Reset your HisabKhata password',
        html: layout(
          'Reset your password',
          p('We received a request to reset your password. This link expires in 30 minutes. If you did not ask for this, ignore this email.') +
            button(d.link, 'Choose a new password'),
        ),
        text: `Reset your password: ${d.link}`,
      };
    case 'invite':
      return {
        subject: `You have been added to ${d.businessName} on HisabKhata`,
        html: layout(
          `Join ${d.businessName}`,
          p(`${esc(d.inviterName)} added you as <strong>${esc(d.roleName)}</strong>.`) +
            (d.link ? p('Set your password to get started:') + button(d.link, 'Set password') : button(`${d.appUrl}/login`, 'Sign in')),
        ),
        text: `You were added to ${d.businessName}. ${d.link ?? d.appUrl + '/login'}`,
      };
    case 'invoice':
      return {
        subject: `Invoice ${d.invoiceNo} from ${d.businessName}`,
        html: layout(
          `Invoice ${d.invoiceNo}`,
          p(`Dear ${esc(d.customerName || 'customer')},`) +
            p(`Please find attached invoice <strong>${esc(d.invoiceNo)}</strong> for <strong>${esc(d.total)}</strong>. Amount due: ${esc(d.due)}.`) +
            p(`Thank you for your business.<br>${esc(d.businessName)}`),
          `Sent on behalf of ${d.businessName} via HisabKhata.`,
        ),
        text: `Invoice ${d.invoiceNo} for ${d.total}. Due: ${d.due}.`,
      };
    case 'low-stock': {
      const rows = (d.items as { name: string; sku: string; stock: string; minStock: string }[])
        .map(
          (i) =>
            `<tr><td style="padding:6px 8px;border-bottom:1px solid #eef1f5">${esc(i.name)}<br><span style="color:#64748b;font-size:12px">${esc(i.sku)}</span></td><td style="padding:6px 8px;border-bottom:1px solid #eef1f5;text-align:right">${esc(i.stock)}</td><td style="padding:6px 8px;border-bottom:1px solid #eef1f5;text-align:right;color:#64748b">${esc(i.minStock)}</td></tr>`,
        )
        .join('');
      return {
        subject: `${d.items.length} products need restocking at ${d.businessName}`,
        html: layout(
          'Low stock summary',
          p(`These products are at or below their minimum stock level.`) +
            `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse"><tr style="text-align:left;color:#64748b"><th style="padding:6px 8px">Product</th><th style="padding:6px 8px;text-align:right">In stock</th><th style="padding:6px 8px;text-align:right">Minimum</th></tr>${rows}</table>` +
            button(`${d.appUrl}/inventory?stock=low`, 'Review inventory'),
        ),
        text: d.items.map((i: any) => `${i.name} (${i.sku}): ${i.stock} / min ${i.minStock}`).join('\n'),
      };
    }
    case 'subscription-expiring':
      return {
        subject: `Your ${d.planName} plan ${d.expired ? 'has expired' : 'expires soon'}`,
        html: layout(
          d.expired ? 'Your plan has expired' : 'Your plan expires soon',
          p(
            d.expired
              ? `The ${esc(d.planName)} plan for ${esc(d.businessName)} ended on ${esc(d.endsAt)}. Your account has moved to the Free plan. Your data is safe.`
              : `The ${esc(d.planName)} plan for ${esc(d.businessName)} ends on ${esc(d.endsAt)}. Renew to keep your limits and features.`,
          ) + button(`${d.appUrl}/subscription`, 'Manage subscription'),
        ),
        text: `Plan ${d.planName} ${d.expired ? 'expired' : 'expires'} on ${d.endsAt}.`,
      };
    case 'payment-confirmation':
      return {
        subject: `Payment received: ${d.planName} plan`,
        html: layout(
          'Payment confirmed',
          p(`We received ${esc(d.amount)} for the <strong>${esc(d.planName)}</strong> plan (${esc(d.interval)}). Reference: ${esc(d.reference)}.`) +
            p(`Your plan is active until ${esc(d.endsAt)}.`),
        ),
        text: `Payment of ${d.amount} received for ${d.planName}.`,
      };
  }
}
