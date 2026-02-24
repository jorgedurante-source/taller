const nodemailer = require('nodemailer');

/**
 * Sends an email using the workshop's configured SMTP settings.
 * @param {object} db Tenant database instance
 * @param {string} to Recipient email address
 * @param {string} subject Email subject
 * @param {string} text Plain text message
 * @param {Array} attachments Array of {filename, content} (buffer)
 * @param {string} html Optional HTML message
 */
async function sendEmail(db, to, subject, text, attachments = [], html = null) {
    const config = db.prepare('SELECT * FROM config LIMIT 1').get() || {};

    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
        console.warn(`[mailer] SMTP not configured for ${config.workshop_name || 'unknown'}. Email to ${to} skipped.`);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port || 587,
        secure: config.smtp_port === 465,
        auth: {
            user: config.smtp_user,
            pass: config.smtp_pass,
        },
        // Force IPv4, as Railway sometimes fails resolving IPv6 for SMTP
        tls: {
            rejectUnauthorized: false
        },
        family: 4
    });

    try {
        await transporter.sendMail({
            from: `"${config.workshop_name}" <${config.smtp_user}>`,
            to,
            subject,
            text,
            html: html || text.replace(/\n/g, '<br>'), // Fallback to text with br
            attachments
        });
        console.log(`[mailer] Email sent to ${to}: ${subject}`);
    } catch (err) {
        console.error('[mailer] Error sending email:', err);
        throw err;
    }
}

module.exports = { sendEmail };
