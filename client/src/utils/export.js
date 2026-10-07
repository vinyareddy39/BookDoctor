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

  // Attached Document info (Photo / PDF)
  if (record.attachmentUrl) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text("Attached Prescription Document / Photo:", 14, finalY);
    
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const attachDesc = `File: ${record.attachmentName || "Prescription File"} (${record.attachmentType === "pdf" ? "PDF Document" : "Photo/Image"}) - Uploaded by ${record.uploadedBy === "patient" ? "Patient" : "Doctor"}`;
    doc.text(attachDesc, 14, finalY + 6);
    doc.text("Original document is archived in the portal and available for download.", 14, finalY + 12);
    finalY += 18;
  }

  // Notes & Remarks
  if (record.notes) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Prescription Notes & Clinical Remarks:", 14, finalY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const splitClinicalNotes = doc.splitTextToSize(record.notes, 180);
    doc.text(splitClinicalNotes, 14, finalY + 6);
    finalY += 10 + splitClinicalNotes.length * 5;
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

export const exportInvoiceToPDF = (invoice, clinicInfo = {}) => {
  if (!invoice) return;

  const doc = new jsPDF();
  const patient = invoice.patientId || {};
  const doctor = invoice.doctorId || {};
  const docName = doctor.userId?.name || doctor.name || null;
  const patName = patient.name || "Patient";
  const clinicName = clinicInfo.name || "MedAssist Healthcare Clinic";
  const clinicPhone = clinicInfo.contactPhone || "+91 98765 43210";
  const clinicAddress = clinicInfo.address?.city || "Healthcare Complex, Bengaluru, India";

  // ── Header Banner ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 26, "F");

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(clinicName, 14, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("Official Medical Services Tax Invoice & Receipt", 14, 21);

  // Status Badge in Header
  const statusUpper = (invoice.status || "ISSUED").toUpperCase();
  const badgeColor = statusUpper === "PAID" ? [34, 197, 94] : statusUpper === "PARTIAL" ? [245, 158, 11] : [239, 68, 68];
  doc.setFillColor(...badgeColor);
  doc.roundedRect(165, 8, 32, 10, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(statusUpper, 181, 14.5, { align: "center" });

  // ── Invoice Metadata & Clinic Info ──
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  // Left: Patient Info
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Billed To (Patient):", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`${patName}`, 14, 42);
  doc.text(`MRN: ${patient.mrn || "N/A"}`, 14, 47);
  doc.text(`Phone: ${patient.phone || "N/A"}`, 14, 52);
  if (patient.email) doc.text(`Email: ${patient.email}`, 14, 57);

  // Right: Invoice Meta
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Invoice Details:", 125, 36);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 125, 42);
  doc.text(`Issue Date: ${new Date(invoice.issuedAt || invoice.createdAt).toLocaleDateString()}`, 125, 47);
  if (docName) doc.text(`Consultant: Dr. ${docName}`, 125, 52);
  if (invoice.dueDate) doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 125, 57);

  // Divider
  doc.setLineWidth(0.4);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 62, 196, 62);

  // ── Line Items Table ──
  const lineItemsData = (invoice.lineItems || []).map((item, idx) => [
    idx + 1,
    item.description,
    item.category?.toUpperCase() || "SERVICE",
    item.quantity,
    `INR ${Number(item.unitPrice).toFixed(2)}`,
    `INR ${Number(item.total).toFixed(2)}`,
  ]);

  doc.autoTable({
    startY: 66,
    head: [["#", "Service Description", "Category", "Qty", "Unit Price", "Total"]],
    body: lineItemsData,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8.5 },
    styles: { cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 70 },
      2: { cellWidth: 28 },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 32, halign: "right" },
      5: { cellWidth: 32, halign: "right" },
    },
  });

  let endY = doc.lastAutoTable.finalY + 8;

  // ── Financial Breakdown Box (Right Aligned) ──
  const summaryX = 115;
  const valueX = 196;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  doc.text("Subtotal:", summaryX, endY);
  doc.text(`INR ${Number(invoice.subtotal || 0).toFixed(2)}`, valueX, endY, { align: "right" });
  endY += 5;

  if (invoice.discountAmount > 0) {
    doc.text(`Discount (${invoice.discountType === "percentage" ? `${invoice.discountValue}%` : "Fixed"}):`, summaryX, endY);
    doc.setTextColor(220, 38, 38);
    doc.text(`- INR ${Number(invoice.discountAmount).toFixed(2)}`, valueX, endY, { align: "right" });
    doc.setTextColor(71, 85, 105);
    endY += 5;
  }

  if (invoice.taxAmount > 0 || invoice.taxRate > 0) {
    doc.text(`Healthcare Tax / GST (${invoice.taxRate || 0}%):`, summaryX, endY);
    doc.text(`INR ${Number(invoice.taxAmount || 0).toFixed(2)}`, valueX, endY, { align: "right" });
    endY += 5;
  }

  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX, endY, valueX, endY);
  endY += 5;

  // Total Invoiced
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Total Invoiced:", summaryX, endY);
  doc.text(`INR ${Number(invoice.totalAmount || 0).toFixed(2)}`, valueX, endY, { align: "right" });
  endY += 6;

  // Total Paid
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(22, 101, 52); // green-700
  doc.text("Paid Amount:", summaryX, endY);
  doc.text(`INR ${Number(invoice.paidAmount || 0).toFixed(2)}`, valueX, endY, { align: "right" });
  endY += 5;

  // Balance Due
  const balance = Number(invoice.balanceAmount || 0);
  doc.setFont("helvetica", "bold");
  if (balance > 0) {
    doc.setTextColor(185, 28, 28); // red-700
    doc.text("Balance Due:", summaryX, endY);
    doc.text(`INR ${balance.toFixed(2)}`, valueX, endY, { align: "right" });
  } else {
    doc.setTextColor(22, 101, 52);
    doc.text("Balance Due:", summaryX, endY);
    doc.text("PAID IN FULL", valueX, endY, { align: "right" });
  }
  endY += 12;

  // ── Payment History Table (if any) ──
  if (invoice.payments && invoice.payments.length > 0) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Receipts & Payment History:", 14, endY);

    const paymentRows = invoice.payments.map((p) => [
      p.receiptNumber || "-",
      new Date(p.recordedAt).toLocaleDateString(),
      p.paymentMethod?.toUpperCase(),
      p.referenceNumber || "-",
      `INR ${Number(p.amount).toFixed(2)}`,
    ]);

    doc.autoTable({
      startY: endY + 3,
      head: [["Receipt #", "Payment Date", "Method", "Reference ID", "Amount Paid"]],
      body: paymentRows,
      theme: "plain",
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 2 },
    });

    endY = doc.lastAutoTable.finalY + 8;
  }

  // ── Footer & Sign-off ──
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text("This is an electronically generated tax invoice valid without physical signature.", 14, 275);
  doc.text(`${clinicName} • ${clinicAddress} • Tel: ${clinicPhone}`, 14, 280);

  doc.setTextColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(140, 274, 196, 274);
  doc.text("Authorized Accounts Signatory", 142, 279);

  const cleanNum = (invoice.invoiceNumber || "INV").replace(/[^a-zA-Z0-9-]/g, "_");
  doc.save(`${cleanNum}_${patName.replace(/\s+/g, "_")}.pdf`);
};

