// _telegram.js
// Notifiche Telegram best-effort verso il bot @prontosite_bot. Usato per
// avvisare quando una generazione asincrona (vedi generate-site.js) finisce,
// dato che Make riceve solo l'accettazione immediata (202) e non aspetta più
// l'esito reale.

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
