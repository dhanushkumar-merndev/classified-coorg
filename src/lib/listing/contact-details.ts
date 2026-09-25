// Mirrors app.text_has_contact_details() so the editor can warn before submit:
// Indian mobile numbers (optional +91 / 0, spaced or dashed) and emails.
export function textHasContactDetails(text: string): boolean {
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return true;
  return /(\+?91|0)?[6-9][0-9]{9}/.test(text.replace(/[\s().-]/g, ""));
}
