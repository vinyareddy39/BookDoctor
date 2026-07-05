import nodemailer from "nodemailer";

const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendBookingConfirmation = async ({ patientName, patientEmail, doctorName, date, time, amount }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[EmailService] Stub: Booking Confirmation to", patientEmail);
    return;
  }

  const mailOptions = {
    from: `"BookDoctor" <${process.env.EMAIL_USER}>`,
    to: patientEmail,
    subject: "Appointment Confirmed - BookDoctor",
    html: `
      <h2>Hello ${patientName || "Patient"},</h2>
      <p>Your appointment with <strong>Dr. ${doctorName || "Doctor"}</strong> has been confirmed.</p>
      <ul>
        <li><strong>Date:</strong> ${new Date(date).toLocaleDateString("en-IN")}</li>
        <li><strong>Time:</strong> ${time}</li>
        <li><strong>Consultation Fee:</strong> ₹${amount}</li>
      </ul>
      <p>Please arrive 10 minutes early at the clinic. You can manage or cancel your appointment from your dashboard.</p>
      <p>Stay healthy!<br/>The BookDoctor Team</p>
    `,
  };

  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
};

export const sendCancellationEmail = async ({ patientName, patientEmail, doctorName, date, time }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[EmailService] Stub: Cancellation Email to", patientEmail);
    return;
  }

  const mailOptions = {
    from: `"BookDoctor" <${process.env.EMAIL_USER}>`,
    to: patientEmail,
    subject: "Appointment Cancelled - BookDoctor",
    html: `
      <h2>Hello ${patientName || "Patient"},</h2>
      <p>Your appointment with <strong>Dr. ${doctorName || "Doctor"}</strong> on ${new Date(date).toLocaleDateString("en-IN")} at ${time} has been cancelled.</p>
      <p>If you have any questions or would like to re-book, please visit our website.</p>
      <p>Stay healthy!<br/>The BookDoctor Team</p>
    `,
  };

  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
};

// ─── Email Verification ───────────────────────────────────────────────────
export const sendVerificationEmail = async (email, name, token) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[EmailService] Stub: Verification email to", email);
    return;
  }

  const verificationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"BookDoctor" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your email - BookDoctor",
    html: `
      <h2>Hello ${name},</h2>
      <p>Thank you for registering on BookDoctor. Please verify your email by clicking the link below:</p>
      <p><a href="${verificationUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
      <p>Or copy this link to your browser: ${verificationUrl}</p>
      <p>The BookDoctor Team</p>
    `,
  };

  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
};

// ─── Password Reset ───────────────────────────────────────────────────────
export const sendResetPasswordEmail = async (email, name, token) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[EmailService] Stub: Password Reset to", email);
    return;
  }

  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"BookDoctor" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Password Reset Request - BookDoctor",
    html: `
      <h2>Hello ${name},</h2>
      <p>You requested a password reset. Please click the link below to set a new password. This link is valid for 30 minutes:</p>
      <p><a href="${resetUrl}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>Or copy this link to your browser: ${resetUrl}</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>The BookDoctor Team</p>
    `,
  };

  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
};

// ─── Reschedule Notification ──────────────────────────────────────────────
export const sendRescheduledEmail = async ({ patientName, patientEmail, doctorName, date, time }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[EmailService] Stub: Reschedule Notification to", patientEmail);
    return;
  }

  const mailOptions = {
    from: `"BookDoctor" <${process.env.EMAIL_USER}>`,
    to: patientEmail,
    subject: "Appointment Rescheduled - BookDoctor",
    html: `
      <h2>Hello ${patientName || "Patient"},</h2>
      <p>Your appointment with <strong>Dr. ${doctorName || "Doctor"}</strong> has been successfully rescheduled.</p>
      <ul>
        <li><strong>New Date:</strong> ${new Date(date).toLocaleDateString("en-IN")}</li>
        <li><strong>New Time:</strong> ${time}</li>
      </ul>
      <p>Please arrive 10 minutes early at the clinic.</p>
      <p>Stay healthy!<br/>The BookDoctor Team</p>
    `,
  };

  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
};

// ─── Appointment Reminder ─────────────────────────────────────────────────
export const sendReminderEmail = async ({ patientName, patientEmail, doctorName, date, time }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[EmailService] Stub: Reminder to", patientEmail);
    return;
  }

  const mailOptions = {
    from: `"BookDoctor" <${process.env.EMAIL_USER}>`,
    to: patientEmail,
    subject: "Appointment Reminder - BookDoctor",
    html: `
      <h2>Hello ${patientName || "Patient"},</h2>
      <p>This is a friendly reminder that you have an upcoming appointment with <strong>Dr. ${doctorName || "Doctor"}</strong> tomorrow.</p>
      <ul>
        <li><strong>Date:</strong> ${new Date(date).toLocaleDateString("en-IN")}</li>
        <li><strong>Time:</strong> ${time}</li>
      </ul>
      <p>Please arrive 10 minutes early at the clinic. If you need to reschedule or cancel, please do so from your dashboard.</p>
      <p>Stay healthy!<br/>The BookDoctor Team</p>
    `,
  };

  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
};
