import nodemailer from 'nodemailer';

const FROM_ADDRESS = process.env.SMTP_FROM || 'DealFlow360 <no-reply@dealflow360.test>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

let transporter = null;
let transporterInitAttempted = false;

// SMTP is optional: a hackathon/dev environment without mail credentials
// should still be able to approve/reject signup requests, just without
// actually sending anything. The transporter is only built once, lazily, and
// any failure to send is logged rather than thrown so a notification issue
// never blocks the admin action that triggered it.
const getTransporter = () => {
    if (transporterInitAttempted) {
        return transporter;
    }
    transporterInitAttempted = true;

    if (!process.env.SMTP_HOST) {
        console.warn('[mail] SMTP_HOST not set - signup approval/rejection emails will be skipped');
        return null;
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
            ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASS}
            : undefined
    });

    return transporter;
};

const sendMail = async ({to, subject, html, text}) => {
    const client = getTransporter();
    if (!client) {
        return {sent: false, reason: 'SMTP not configured'};
    }

    try {
        await client.sendMail({from: FROM_ADDRESS, to, subject, html, text});
        return {sent: true};
    } catch (error) {
        console.error(`[mail] Failed to send "${subject}" to ${to}:`, error.message);
        return {sent: false, reason: error.message};
    }
};

const formatRole = (role) => String(role || '').replace(/_/g, ' ');

const sendSignupApprovedEmail = ({to, fullName, role}) =>
    sendMail({
        to,
        subject: 'Your DealFlow360 account request was approved',
        text: `Hi ${fullName},\n\nYour request for an internal DealFlow360 account (${formatRole(role)}) has been approved. You can now sign in with the email and password you used to request access:\n\n${FRONTEND_URL}/login\n\n- DealFlow360`,
        html: `<p>Hi ${fullName},</p><p>Your request for an internal DealFlow360 account (<strong>${formatRole(role)}</strong>) has been <strong style="color:#16a34a">approved</strong>. You can now sign in with the email and password you used to request access.</p><p><a href="${FRONTEND_URL}/login">Sign in to DealFlow360</a></p><p>- DealFlow360</p>`
    });

const sendSignupRejectedEmail = ({to, fullName, reason}) =>
    sendMail({
        to,
        subject: 'Your DealFlow360 account request was declined',
        text: `Hi ${fullName},\n\nYour request for an internal DealFlow360 account was declined by an administrator.${reason ? `\n\nReason: ${reason}` : ''}\n\nIf you believe this is a mistake, please contact your administrator.\n\n- DealFlow360`,
        html: `<p>Hi ${fullName},</p><p>Your request for an internal DealFlow360 account was <strong style="color:#dc2626">declined</strong> by an administrator.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}<p>If you believe this is a mistake, please contact your administrator.</p><p>- DealFlow360</p>`
    });

export {sendMail, sendSignupApprovedEmail, sendSignupRejectedEmail};
