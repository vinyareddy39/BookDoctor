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
