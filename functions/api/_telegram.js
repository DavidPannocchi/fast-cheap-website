export async function sendTelegramMessage(env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('Telegram non configurato (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID mancanti), notifica saltata.');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      console.error('Invio notifica Telegram fallito:', await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Errore invio notifica Telegram:', err.message);
  }
}
