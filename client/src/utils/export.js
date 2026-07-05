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

export const exportPrescriptionToPDF = (appointment, doctorName) => {
  if (!appointment || !appointment.prescription) return;

  const doc = new jsPDF();
  
  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text("Clinical Prescription", 14, 20);

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Doctor: Dr. ${doctorName}`, 14, 30);
  doc.text(`Patient: ${appointment.patientId?.name || "Unknown"}`, 14, 36);
  doc.text(`Date: ${new Date(appointment.appointmentDate).toLocaleDateString()}`, 14, 42);

  doc.setLineWidth(0.5);
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 48, 196, 48);

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("Notes & Medication:", 14, 58);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  
  // Split text for word wrapping
  const splitNotes = doc.splitTextToSize(appointment.prescription, 180);
  doc.text(splitNotes, 14, 66);

  doc.save(`Prescription_${appointment.patientId?.name || "Patient"}_${appointment.appointmentDate.split("T")[0]}.pdf`);
};
