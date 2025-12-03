require("dotenv").config();

const { sendEmail, isUsingTestEmail } = require("../utils/mailer");

async function main() {
  const targetEmail = process.argv[2] || process.env.TEST_EMAIL_TO;

  if (!targetEmail) {
    console.error(
      "Usage: node scripts/testEmail.js <recipientEmail>\n" +
        "Or set TEST_EMAIL_TO in your environment."
    );
    process.exitCode = 1;
    return;
  }

  try {
    const timestamp = new Date().toISOString();
    const info = await sendEmail({
      to: targetEmail,
      subject: "INTEX email test",
      text: `Hi there! This is a test message sent at ${timestamp}.`,
      html: `<p>Hi there!</p><p>This is a test message sent at <strong>${timestamp}</strong>.</p>`,
    });
    console.log(
      "Email sent:",
      info && (info.messageId || info.response || info)
    );
    if (info && info.previewUrl) {
      console.log("Preview URL:", info.previewUrl);
    } else if (isUsingTestEmail()) {
      console.log(
        "Test transport in use, but preview URL unavailable. Check terminal for Ethereal credentials."
      );
    }
  } catch (err) {
    console.error("Unable to send test email:", err);
    process.exitCode = 1;
  }
}

main();
