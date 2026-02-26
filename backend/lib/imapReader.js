const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

/**
 * Connects to IMAP and checks for response emails related to orders or part inquiries.
 * @param {object} db Tenant database instance
 * @param {string} slug Tenant slug
 */
async function checkEmails(db, slug) {
    const config = db.prepare('SELECT * FROM config LIMIT 1').get() || {};

    if (!config.imap_enabled || !config.imap_host || !config.imap_user || !config.imap_pass) {
        return;
    }

    const imapConfig = {
        imap: {
            user: config.imap_user,
            password: config.imap_pass,
            host: config.imap_host,
            port: config.imap_port || 993,
            tls: true,
            authTimeout: 30000,
            connTimeout: 30000,
            tlsOptions: { rejectUnauthorized: false }
        }
    };

    try {
        const connection = await imaps.connect(imapConfig);
        await connection.openBox('INBOX');

        // Search for unseen messages from the last 2 days
        const delay = 24 * 3600 * 1000 * 2;
        const yesterday = new Date(Date.now() - delay).toISOString();
        const searchCriteria = [['SINCE', yesterday]]; // Modified: Removed 'UNSEEN' to include all messages
        const fetchOptions = { bodies: ['HEADER', ''], markSeen: false }; // Don't mark as seen automatically

        const messages = await connection.search(searchCriteria, fetchOptions);

        for (const message of messages) {
            const uid = message.attributes.uid;
            const header = message.parts.find(p => p.which === 'HEADER');
            const fullBodyPart = message.parts.find(p => p.which === '');
            const fullSubject = header.body.subject ? header.body.subject[0] : '';

            // Try to extract Order ID from subject: "(Orden #123)"
            const orderMatch = fullSubject.match(/\(Orden\s*#(\d+)\)/i);

            if (orderMatch && fullBodyPart) {
                const orderId = orderMatch[1];
                const parsed = await simpleParser(fullBodyPart.body);
                let text = parsed.text || '';
                const fromRaw = parsed.from ? parsed.from.text : 'Desconocido';
                const fromEmail = (parsed.from && parsed.from.value && parsed.from.value[0]) ? parsed.from.value[0].address : null;

                // Mark as seen in the server since we found a matching order
                // This informs the server that our system has "consumed" this message
                connection.addFlags(uid, '\\Seen').catch(err => console.error('Error marking seen:', err));

                // Limpiar el texto: Solo queremos la respuesta nueva, no el hilo anterior
                const replyDelimiters = [
                    /^El\s+.*escribió:$/m,
                    /^On\s+.*wrote:$/m,
                    /^De:.*$/m,
                    /^From:.*$/m,
                    /^---/m,
                    /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/m
                ];

                let cleanText = text;
                for (const delimiter of replyDelimiters) {
                    const match = cleanText.match(delimiter);
                    if (match) {
                        cleanText = cleanText.substring(0, match.index).trim();
                    }
                }

                if (!cleanText) cleanText = text.substring(0, 300);

                // EVITAR DUPLICADOS
                const sample = cleanText.substring(0, 100);
                const exists = db.prepare(`
                    SELECT id FROM order_history
                    WHERE order_id = ? AND notes LIKE ?
                `).get(orderId, `%${sample}%`);

                if (!exists) {
                    console.log(`[imap:${slug}] Saving NEW reply for Order #${orderId} from ${fromRaw}`);

                    db.prepare(`
                        INSERT INTO order_history (order_id, status, notes, reply_to, user_id, is_read)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(
                        orderId,
                        'Respuesta Recibida',
                        `Respuesta de ${fromRaw}:\n${cleanText}`,
                        fromEmail,
                        null, // System generated
                        0 // is_read = 0 (unread in dashboard)
                    );
                }
            }
        }

        connection.end();
    } catch (err) {
        console.error(`[imap:${slug}] Error checking emails:`, err.message);
    }
}

module.exports = { checkEmails };
