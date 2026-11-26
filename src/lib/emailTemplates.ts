export interface EmailTemplate { id: string; subject: string; body: string }
const templates = new Map<string, EmailTemplate>();
export function registerTemplate(t: EmailTemplate) { templates.set(t.id, t); }
export function renderTemplate(id: string, vars: Record<string, unknown>) {
  const t = templates.get(id);
  if (!t) throw new Error(`Template not found: ${id}`);
  let body = t.body;
  for (const [k, v] of Object.entries(vars)) body = body.replace(new RegExp(`{{${k}}}`, "g"), String(v));
  return { subject: t.subject, body };
}