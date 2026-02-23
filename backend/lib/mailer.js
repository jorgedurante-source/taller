const nodemailer = require('nodemailer');

/**
 * Sends an email using the workshop's configured SMTP settings.
 * @param {object} db Tenant database instance
 * @param {string} to Recipient email address
 * @param {string} subject Email subject
 * @param {string} text Plain text message
 * @param {Array} attachments Array of {filename, content} (buffer)
 */
async function sendEmail(db, to, subject, text, attachments = []) {
    const config = db.prepare('SELECT * FROM config LIMIT 1').get() || {};

    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
        console.warn('SMTP support is not fully configured. Email skipped.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port || 587,
        secure: config.smtp_port === 465, // true for 465, false for other ports
        auth: {
            user: config.smtp_user,
            pass: config.smtp_pass,
        },
    });

    try {
        await transporter.sendMail({
            from: `"${config.workshop_name}" <${config.smtp_user}>`,
            to,
            subject,
            text,
            attachments
        });
        console.log(`Email sent to ${to}`);
    } catch (err) {
        console.error('Error sending email:', err);
        throw err;
    }
}

module.exports = { sendEmail };
