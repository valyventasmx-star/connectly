// Unified message sender — routes to the right platform API
import axios from 'axios';

// ─── WhatsApp ──────────────────────────────────────────────────────────────
export async function sendWhatsApp(accessToken: string, phoneNumberId: string, to: string, text: string) {
  return axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

// ─── Instagram DM ──────────────────────────────────────────────────────────
export async function sendInstagramMessage(pageAccessToken: string, recipientId: string, text: string) {
  return axios.post(
    `https://graph.facebook.com/v19.0/me/messages`,
    { recipient: { id: recipientId }, message: { text }, messaging_type: 'RESPONSE' },
    { params: { access_token: pageAccessToken } }
  );
}

// ─── Facebook Messenger ────────────────────────────────────────────────────
export async function sendMessengerMessage(pageAccessToken: string, recipientPSID: string, text: string) {
  return axios.post(
    `https://graph.facebook.com/v19.0/me/messages`,
    { recipient: { id: recipientPSID }, message: { text }, messaging_type: 'RESPONSE' },
    { params: { access_token: pageAccessToken } }
  );
}

// ─── Telegram ──────────────────────────────────────────────────────────────
export async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  return axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  });
}

// ─── Twilio SMS ────────────────────────────────────────────────────────────
export async function sendSmsMessage(accountSid: string, authToken: string, from: string, to: string, text: string) {
  return axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({ To: to, From: from, Body: text }),
    {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
}

// ─── Unified dispatcher ────────────────────────────────────────────────────
export async function sendPlatformMessage(channel: any, contact: any, text: string): Promise<string | undefined> {
  try {
    if (channel.type === 'whatsapp' && channel.accessToken && channel.phoneNumberId && contact.phone) {
      const r = await sendWhatsApp(channel.accessToken, channel.phoneNumberId, contact.phone, text);
      return r.data?.messages?.[0]?.id;
    }
    if (channel.type === 'instagram' && channel.pageAccessToken && contact.externalId) {
      const r = await sendInstagramMessage(channel.pageAccessToken, contact.externalId, text);
      return r.data?.message_id;
    }
    if (channel.type === 'messenger' && channel.pageAccessToken && contact.externalId) {
      const r = await sendMessengerMessage(channel.pageAccessToken, contact.externalId, text);
      return r.data?.message_id;
    }
    if (channel.type === 'telegram' && channel.telegramBotToken && contact.externalId) {
      const r = await sendTelegramMessage(channel.telegramBotToken, contact.externalId, text);
      return String(r.data?.result?.message_id);
    }
    if (channel.type === 'sms' && channel.twilioAccountSid && channel.twilioAuthToken && channel.twilioFromNumber && contact.phone) {
      const r = await sendSmsMessage(channel.twilioAccountSid, channel.twilioAuthToken, channel.twilioFromNumber, contact.phone, text);
      return r.data?.sid;
    }
  } catch (e: any) {
    console.error(`Failed to send via ${channel.type}:`, e.response?.data || e.message);
  }
  return undefined;
}
