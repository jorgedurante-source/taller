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
    const provider = config.mail_provider || 'smtp';

    const fromAddress = `"${config.workshop_name}" <${config.smtp_user}>`;
    const finalHtml = html || text.replace(/\n/g, '<br>');

    try {
        if (provider === 'resend' && config.resend_api_key) {
            const { Resend } = require('resend');
            const resend = new Resend(config.resend_api_key);

            // Format attachments for Resend if any exist
            const resendAttachments = attachments.map(att => ({
                filename: att.filename,
                content: att.content // Resend accepts Buffer
            }));

            const { data, error } = await resend.emails.send({
                from: fromAddress,
                to: [to],
                replyTo: config.email, // Formato camelCase por si acaso
                subject: subject,
                html: finalHtml,
                text: text,
                attachments: resendAttachments.length > 0 ? resendAttachments : undefined
            });

            if (error) {
                console.error('[mailer:resend] Error sending email:', error);
                throw new Error(error.message);
            }
            console.log(`[mailer:resend] Email sent to ${to}: ${subject} (Reply-To: ${config.email})`);

        } else {
            // Default to SMTP
            if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
                console.warn(`[mailer] SMTP not configured. Email to ${to} skipped.`);
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
                tls: {
                    rejectUnauthorized: false
                },
                family: 4,
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 20000
            });

            await transporter.sendMail({
                from: fromAddress,
                to,
                replyTo: config.email, // También para SMTP tradicional
                subject,
                text,
                html: finalHtml,
                attachments
            });
            console.log(`[mailer:smtp] Email sent to ${to}: ${subject} (Reply-To: ${config.email})`);
        }
    } catch (err) {
        console.error('[mailer] Error sending email:', err);
        throw err;
    }
}

module.exports = { sendEmail };
