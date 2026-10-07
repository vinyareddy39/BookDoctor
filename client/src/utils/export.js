import jsPDF from "jspdf";
import "jspdf-autotable";

export const exportToCSV = (data, filename = "report.csv") => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(","));

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + val).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const exportToPDF = (data, title = "Report", filename = "report.pdf") => {
  if (!data || !data.length) return;

  const doc = new jsPDF();
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(header => row[header]));

  doc.text(title, 14, 15);
  
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 20,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [59, 130, 246] } // Tailwind blue-500
  });

  doc.save(filename);
};

export const exportPrescriptionToPDF = (record, doctorName) => {
  if (!record) return;

  const doc = new jsPDF();
  const patient = record.patientId || {};
  const doctor = record.doctorId || {};
  const docName = doctorName || doctor.userId?.name || doctor.name || "Attending Physician";
  const patName = patient.name || "Patient";
  const dateStr = record.signedAt || record.createdAt || record.appointmentDate || new Date();
  const formattedDate = new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ── Header / Clinic Branding ──
  doc.setFillColor(30, 58, 138); // primary blue-900
  doc.rect(0, 0, 210, 24, "F");

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("MedAssist Clinic • Medical Prescription", 14, 16);

  // ── Doctor & Patient Info ──
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");

  // Left column: Doctor
  doc.text(`Doctor: Dr. ${docName}`, 14, 34);
  if (doctor.qualification) doc.text(`Qualification: ${doctor.qualification}`, 14, 40);
  if (doctor.clinicName) doc.text(`Clinic: ${doctor.clinicName}`, 14, 46);

  // Right column: Patient
  doc.text(`Patient: ${patName}`, 120, 34);
  doc.text(`MRN: ${patient.mrn || "N/A"}`, 120, 40);
  doc.text(`Date: ${formattedDate}`, 120, 46);
  if (patient.bloodGroup) doc.text(`Blood Group: ${patient.bloodGroup}`, 120, 52);

  // Divider
  doc.setLineWidth(0.5);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 56, 196, 56);

  // ── Prescription Table or Text ──
  let finalY = 62;
  if (Array.isArray(record.medicines) && record.medicines.length > 0) {
    const tableData = record.medicines.map((m, idx) => [
      idx + 1,
      m.name,
      m.dosage || "-",
      m.frequency || "-",
      m.duration || "-",
      `${m.timing?.replace("_", " ") || ""} ${m.instructions ? `• ${m.instructions}` : ""}`,
    ]);

    doc.autoTable({
      startY: 60,
      head: [["#", "Medicine", "Dosage", "Frequency", "Duration", "Instructions"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [30, 58, 138], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 8.5 },
      styles: { cellPadding: 2.5 },
    });

    finalY = doc.lastAutoTable.finalY + 10;
  } else if (record.prescription) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("Prescribed Medication & Notes:", 14, 66);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const splitNotes = doc.splitTextToSize(record.prescription, 180);
    doc.text(splitNotes, 14, 74);
    finalY = 74 + splitNotes.length * 6;
  }

  // General Instructions
  if (record.generalInstructions) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Special Instructions:", 14, finalY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const splitInstructions = doc.splitTextToSize(record.generalInstructions, 180);
    doc.text(splitInstructions, 14, finalY + 6);
    finalY += 12 + splitInstructions.length * 5;
  }

  // Footer / Doctor Sign-off
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Electronically signed via MedAssist Portal. Valid for 30 days.", 14, 280);
  doc.text(`Dr. ${docName}`, 160, 275);
  doc.setLineWidth(0.3);
  doc.line(150, 278, 196, 278);
  doc.text("Authorized Signature", 155, 283);

  const cleanDate = new Date(dateStr).toISOString().split("T")[0];
  doc.save(`Prescription_${patName.replace(/\s+/g, "_")}_${cleanDate}.pdf`);
};

export const exportLabReportToPDF = (order) => {
  if (!order) return;

  const doc = new jsPDF();
  const patient = order.patientId || {};
  const doctor = order.doctorId || {};
  const docName = doctor.userId?.name || doctor.name || "Ordering Physician";
  const patName = patient.name || "Patient";
  const result = order.labResultId || {};
  const parameters = result.parameters || [];

  // ── Header / Lab Banner ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 24, "F");

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("MedAssist Laboratory • Diagnostic Test Report", 14, 16);

  // ── Patient & Order Metadata ──
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");

  // Left Column
  doc.text(`Patient: ${patName}`, 14, 34);
  doc.text(`MRN: ${patient.mrn || "N/A"}`, 14, 40);
  doc.text(`Gender/Age: ${patient.gender?.toUpperCase() || "N/A"}`, 14, 46);
  doc.text(`Ordering Doctor: Dr. ${docName}`, 14, 52);

  // Right Column
  doc.text(`Order Number: ${order.orderNumber}`, 120, 34);
  doc.text(`Priority: ${order.priority?.toUpperCase()}`, 120, 40);
  doc.text(`Ordered Date: ${new Date(order.orderedAt).toLocaleDateString()}`, 120, 46);
  if (order.releasedAt) {
    doc.text(`Released Date: ${new Date(order.releasedAt).toLocaleDateString()}`, 120, 52);
  }

  // Divider
  doc.setLineWidth(0.5);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 56, 196, 56);

  // ── Test Panels Ordered ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  const testNames = order.tests?.map((t) => t.name).join(", ") || "Laboratory Investigation";
  doc.text(`Tests Ordered: ${testNames}`, 14, 63);

  // ── Parameters Table ──
  const tableData = parameters.map((p) => [
    p.name,
    p.value,
    p.unit || "-",
    p.referenceRange || "-",
    p.flag?.toUpperCase() || "NORMAL",
  ]);

  doc.autoTable({
    startY: 68,
    head: [["Test Parameter", "Observed Value", "Units", "Reference Range", "Flag"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8.5 },
    styles: { cellPadding: 2.5 },
    didParseCell: function (data) {
      if (data.column.index === 4 && data.cell.text[0] && data.cell.text[0] !== "NORMAL") {
        data.cell.styles.textColor = [220, 38, 38]; // Red for abnormal/critical
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  let finalY = doc.lastAutoTable.finalY + 10;

  // Clinical Interpretation
  if (result.interpretation) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Laboratory Comments & Clinical Interpretation:", 14, finalY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const splitInterp = doc.splitTextToSize(result.interpretation, 180);
    doc.text(splitInterp, 14, finalY + 6);
    finalY += 12 + splitInterp.length * 5;
  }

  // Signatures
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Verified by Certified Clinical Laboratory Technician.", 14, 275);
  doc.text("MedAssist Electronic Verification System", 14, 280);

  doc.setTextColor(30, 41, 59);
  doc.text(`Entered by: ${order.resultEnteredBy?.name || "Lab Tech"}`, 130, 268);
  doc.text(`Verified by: ${order.verifiedBy?.name || "Medical Officer"}`, 130, 274);
  doc.setLineWidth(0.3);
  doc.line(130, 278, 196, 278);
  doc.text("Authorized Laboratory Sign-off", 130, 283);

  const cleanOrderNum = (order.orderNumber || "LAB").replace(/[^a-zA-Z0-9-]/g, "_");
  doc.save(`LabReport_${cleanOrderNum}.pdf`);
};
