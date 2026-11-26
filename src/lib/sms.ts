export interface SmsMessage { to: string; body: string }
export async function sendSms(msg: SmsMessage) {
  // Provider integration placeholder
  return { success: true, id: `sms_${Date.now()}` };
}