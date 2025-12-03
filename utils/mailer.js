const nodemailer = require("nodemailer");

let cachedTransporter = null;
let cachedMailerConfig = null;

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
}

function resolveEmailConfig() {
  const port =
    Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587) || 587;
  return {
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST || null,
    port,
    secure:
      typeof process.env.EMAIL_SECURE !== "undefined"
        ? parseBoolean(process.env.EMAIL_SECURE)
        : typeof process.env.SMTP_SECURE !== "undefined"
        ? parseBoolean(process.env.SMTP_SECURE)
        : port === 465,
    authUser:
      process.env.EMAIL_USER ||
      process.env.SMTP_USER ||
      process.env.EMAIL_USERNAME ||
      null,
    authPass:
      process.env.EMAIL_PASSWORD ||
      process.env.SMTP_PASSWORD ||
      process.env.EMAIL_PASS ||
      null,
    defaultFrom:
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      process.env.EMAIL_USER ||
      null,
  };
}

function isEmailConfigured() {
  const { host, authUser, authPass, defaultFrom } = resolveEmailConfig();
  return Boolean(host && authUser && authPass && defaultFrom);
}

async function getMailerContext() {
  if (cachedTransporter && cachedMailerConfig) {
    return { transporter: cachedTransporter, config: cachedMailerConfig };
  }

  if (isEmailConfigured()) {
    const envConfig = resolveEmailConfig();
    cachedTransporter = nodemailer.createTransport({
      host: envConfig.host,
      port: envConfig.port,
      secure: envConfig.secure,
      auth: {
        user: envConfig.authUser,
        pass: envConfig.authPass,
      },
    });
    cachedMailerConfig = {
      defaultFrom: envConfig.defaultFrom,
      isTestAccount: false,
    };
    return { transporter: cachedTransporter, config: cachedMailerConfig };
  }

  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  cachedMailerConfig = {
    defaultFrom: `INTEX Dev <${testAccount.user}>`,
    isTestAccount: true,
    etherealUser: testAccount.user,
    etherealPass: testAccount.pass,
  };
  console.warn(
    "Email env vars missing; using Ethereal test SMTP. Emails are NOT delivered."
  );
  console.warn(`Ethereal credentials: ${testAccount.user} / ${testAccount.pass}`);
  console.warn("View inbox at https://ethereal.email/messages");
  return { transporter: cachedTransporter, config: cachedMailerConfig };
}

function isUsingTestEmail() {
  if (cachedMailerConfig) {
    return Boolean(cachedMailerConfig.isTestAccount);
  }
  return !isEmailConfigured();
}

async function sendEmail({
  to,
  subject,
  text,
  html,
  cc,
  bcc,
  replyTo,
  from,
}) {
  if (!to) {
    throw new Error("sendEmail requires a `to` address");
  }

  const { transporter, config } = await getMailerContext();

  const info = await transporter.sendMail({
    from: from || config.defaultFrom,
    to,
    subject,
    text,
    html,
    cc,
    bcc,
    replyTo,
  });

  if (config.isTestAccount) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      info.previewUrl = previewUrl;
      console.log("Ethereal preview URL:", previewUrl);
    }
  }

  return info;
}

module.exports = {
  sendEmail,
  isEmailConfigured,
  isUsingTestEmail,
};
