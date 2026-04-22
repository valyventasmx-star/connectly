import axios from 'axios';

const WA_API_BASE = 'https://graph.facebook.com/v18.0';

export async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  content: string,
  type: string = 'text'
) {
  const cleanTo = to.replace(/\D/g, '');

  let messagePayload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
  };

  if (type === 'text') {
    messagePayload.type = 'text';
    messagePayload.text = { body: content, preview_url: false };
  } else if (type === 'template') {
    // Template messages parsed from content as JSON
    try {
      const parsed = JSON.parse(content);
      messagePayload.type = 'template';
      messagePayload.template = parsed;
    } catch {
      messagePayload.type = 'text';
      messagePayload.text = { body: content };
    }
  } else {
    messagePayload.type = 'text';
    messagePayload.text = { body: content };
  }

  const response = await axios.post(
    `${WA_API_BASE}/${phoneNumberId}/messages`,
    messagePayload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
}

export async function markMessageAsRead(
  accessToken: string,
  phoneNumberId: string,
  waMessageId: string
) {
  await axios.post(
    `${WA_API_BASE}/${phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', status: 'read', message_id: waMessageId },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
}

export async function getPhoneNumberInfo(accessToken: string, phoneNumberId: string) {
  const response = await axios.get(`${WA_API_BASE}/${phoneNumberId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}
