import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getAccount } from "@/lib/accounting";
import type { Account, BusinessProfile, ProfitLossReport, BalanceSheetReport } from "@/lib/types";

// Helper for formatting number inside export sheets
const rawFormatCurrency = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

// Generates signature footer on PDF
function addPdfSignature(doc: jsPDF, profile: BusinessProfile, startY: number) {
  const pageHeight = doc.internal.pageSize.height;
  let signatureY = startY + 15;

  if (signatureY + 25 > pageHeight) {
    doc.addPage();
    signatureY = 20;
  }

  const today = new Date();
  const dateStr = `Pekanbaru, ${today.getDate()} ${
    ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][today.getMonth()]
  } ${today.getFullYear()}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122); // zinc-500

  doc.text(dateStr, 105, signatureY, { align: "center" });
  doc.text("Penanggung Jawab,", 105, signatureY + 6, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27); // zinc-900
  doc.text(profile.ownerName || "NOVIA SINATA", 105, signatureY + 25, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122); // zinc-500
  doc.text(profile.businessType === "freelancer" ? "Freelancer" : "Direktur / Pemilik", 105, signatureY + 29, { align: "center" });
}

// Generates header metadata for PDF
function addPdfHeader(doc: jsPDF, title: string, profile: BusinessProfile, year: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title.toUpperCase(), 105, 15, { align: "center" });

  doc.setFontSize(11);
  doc.text(profile.businessName.toUpperCase(), 105, 21, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Tahun Pajak ${year} | Periode: 1 Januari - 31 Desember ${year}`, 105, 27, { align: "center" });

  if (title.includes("Peredaran Bruto")) {
    doc.setFont("helvetica", "italic");
    doc.text("Skema Perpajakan: PPh Final UMKM 0,5% (PP No. 23 Tahun 2018 jo. PP No. 55/2022)", 105, 32, { align: "center" });
    doc.setFont("helvetica", "normal");
  }

  doc.setLineWidth(0.5);
  doc.line(15, 36, 195, 36);
  doc.setLineWidth(0.15);
  doc.line(15, 37, 195, 37);

  doc.setFontSize(8.5);
  doc.text(`NPWP Perusahaan : ${profile.taxNumber || "-"}`, 15, 43);
  doc.text(`Penanggung Jawab : ${profile.ownerName || "-"}`, 15, 48);
  doc.text(`NPWP Penanggung Jawab : -`, 15, 53);

  const today = new Date();
  doc.text(`Tanggal Pelaporan : ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`, 130, 43);
}

// ── PDF EXPORT CHANNELS ──

export function exportPeredaranBrutoPDF(
  profile: BusinessProfile,
  year: number,
  monthlyReports: { monthName: string; grossRevenue: number; tax: number; cumOmset: number; cumTax: number }[]
) {
  const doc = new jsPDF("p", "mm", "a4");
  addPdfHeader(doc, "Laporan Peredaran Bruto (Omset) UMKM", profile, year);

  const tableBody = monthlyReports.map((item, index) => [
    index + 1,
    item.monthName,
    rawFormatCurrency(item.grossRevenue),
    rawFormatCurrency(item.tax),
    rawFormatCurrency(item.cumOmset),
    rawFormatCurrency(item.cumTax),
    "-"
  ]);

  const totalGross = monthlyReports.reduce((sum, item) => sum + item.grossRevenue, 0);
  const totalTax = monthlyReports.reduce((sum, item) => sum + item.tax, 0);

  tableBody.push([
    "",
    "TOTAL TAHUN " + year,
    rawFormatCurrency(totalGross),
    rawFormatCurrency(totalTax),
    "-",
    "-",
    "Total Setahun"
  ]);

  autoTable(doc, {
    head: [["No.", "Bulan", "Peredaran Bruto (Rp)", "PPh Final 0,5% (Rp)", "Kumulatif Omset (Rp)", "Kumulatif PPh (Rp)", "Keterangan"]],
    body: tableBody,
    startY: 59,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: "bold" as const },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { fontStyle: "bold" as const },
      2: { halign: "right" as const },
      3: { halign: "right" as const },
      4: { halign: "right" as const },
      5: { halign: "right" as const }
    },
    didParseCell: (data) => {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        if (data.cell.section === "body") {
          data.cell.styles.fillColor = [244, 244, 245];
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.text("Catatan:", 15, finalY + 8);
  doc.text("1. PPh Final 0,5% dihitung berdasarkan PP No. 55 Tahun 2022 dengan batas omset tidak kena pajak Rp 500 Juta setahun untuk wajib pajak OP.", 15, finalY + 12);
  doc.text("2. Penyetoran pajak PPh Final wajib dibayarkan paling lambat tanggal 15 bulan berikutnya.", 15, finalY + 16);

  addPdfSignature(doc, profile, finalY + 12);
  doc.save(`KasFlow_Peredaran_Bruto_${year}_${profile.businessName.replace(/\s+/g, "_")}.pdf`);
}

export function exportProfitLossPDF(
  profile: BusinessProfile,
  year: number,
  profitLoss: ProfitLossReport,
  accounts: Account[]
) {
  const doc = new jsPDF("p", "mm", "a4");
  addPdfHeader(doc, "Laporan Laba Rugi (Income Statement)", profile, year);

  const tableBody: any[] = [];
  const grayBg = [244, 244, 245] as [number, number, number];

  // I. Pendapatan Usaha
  tableBody.push([{ content: "I. PENDAPATAN USAHA", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: grayBg } }]);
  Object.entries(profitLoss.revenueByAccount).forEach(([accountId, val]) => {
    const acc = getAccount(accounts, accountId);
    tableBody.push(["", `${acc?.code || ""} - ${acc?.name || ""}`, rawFormatCurrency(val)]);
  });
  tableBody.push(["", "Total Pendapatan Usaha", { content: rawFormatCurrency(profitLoss.revenue), styles: { fontStyle: "bold" as const } }]);

  // II. HPP
  if (profitLoss.cogs > 0) {
    tableBody.push([{ content: "II. HARGA POKOK PENJUALAN (HPP)", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: grayBg } }]);
    Object.entries(profitLoss.cogsByAccount).forEach(([accountId, val]) => {
      const acc = getAccount(accounts, accountId);
      tableBody.push(["", `${acc?.code || ""} - ${acc?.name || ""}`, `-${rawFormatCurrency(val)}`]);
    });
    tableBody.push(["", "Total HPP", { content: `-${rawFormatCurrency(profitLoss.cogs)}`, styles: { fontStyle: "bold" as const, textColor: [239, 68, 68] as [number, number, number] } }]);
  }

  // III. Laba Kotor
  if (profitLoss.cogs > 0) {
    tableBody.push([{
      content: "III. LABA KOTOR",
      colSpan: 2,
      styles: { fontStyle: "bold" as const, fillColor: [228, 228, 231] as [number, number, number] }
    }, {
      content: rawFormatCurrency(profitLoss.grossProfit),
      styles: { fontStyle: "bold" as const, fillColor: [228, 228, 231] as [number, number, number], halign: "right" as const }
    }]);
  }

  // IV. Beban Operasional
  tableBody.push([{ content: "IV. BEBAN OPERASIONAL", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: grayBg } }]);

  // A. Beban Penjualan
  if (Object.keys(profitLoss.sellingByAccount).length > 0) {
    tableBody.push([{ content: "A. Beban Penjualan", colSpan: 3, styles: { fontStyle: "italic" as const } }]);
    Object.entries(profitLoss.sellingByAccount).forEach(([accountId, val]) => {
      const acc = getAccount(accounts, accountId);
      tableBody.push(["", `  ${acc?.code || ""} - ${acc?.name || ""}`, `-${rawFormatCurrency(val)}`]);
    });
    tableBody.push(["", "Subtotal Beban Penjualan", { content: `-${rawFormatCurrency(profitLoss.sellingExpenses)}`, styles: { textColor: [239, 68, 68] as [number, number, number] } }]);
  }

  // B. Beban Administrasi & Umum
  if (Object.keys(profitLoss.adminByAccount).length > 0) {
    tableBody.push([{ content: "B. Beban Administrasi & Umum", colSpan: 3, styles: { fontStyle: "italic" as const } }]);
    Object.entries(profitLoss.adminByAccount).forEach(([accountId, val]) => {
      const acc = getAccount(accounts, accountId);
      tableBody.push(["", `  ${acc?.code || ""} - ${acc?.name || ""}`, `-${rawFormatCurrency(val)}`]);
    });
    tableBody.push(["", "Subtotal Beban Administrasi", { content: `-${rawFormatCurrency(profitLoss.adminExpenses)}`, styles: { textColor: [239, 68, 68] as [number, number, number] } }]);
  }

  // C. Beban Operasional Lainnya
  if (Object.keys(profitLoss.otherOperatingByAccount).length > 0) {
    tableBody.push([{ content: "C. Beban Operasional Lainnya", colSpan: 3, styles: { fontStyle: "italic" as const } }]);
    Object.entries(profitLoss.otherOperatingByAccount).forEach(([accountId, val]) => {
      const acc = getAccount(accounts, accountId);
      tableBody.push(["", `  ${acc?.code || ""} - ${acc?.name || ""}`, `-${rawFormatCurrency(val)}`]);
    });
    tableBody.push(["", "Subtotal Beban Operasional Lainnya", { content: `-${rawFormatCurrency(profitLoss.otherOperatingExpenses)}`, styles: { textColor: [239, 68, 68] as [number, number, number] } }]);
  }

  tableBody.push(["", "Total Beban Operasional", { content: `-${rawFormatCurrency(profitLoss.totalOperatingExpenses)}`, styles: { fontStyle: "bold" as const, textColor: [239, 68, 68] as [number, number, number] } }]);

  // V. Laba Operasional (EBIT)
  tableBody.push([{
    content: "V. LABA OPERASIONAL (EBIT)",
    colSpan: 2,
    styles: { fontStyle: "bold" as const, fillColor: [228, 228, 231] as [number, number, number] }
  }, {
    content: rawFormatCurrency(profitLoss.ebit),
    styles: { fontStyle: "bold" as const, fillColor: [228, 228, 231] as [number, number, number], halign: "right" as const }
  }]);

  // VI. Pendapatan/Beban Lain
  if (profitLoss.nonOperatingIncome > 0 || profitLoss.nonOperatingExpense > 0) {
    tableBody.push([{ content: "VI. PENDAPATAN & BEBAN DI LUAR USAHA", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: grayBg } }]);
    Object.entries(profitLoss.nonOperatingIncomeByAccount).forEach(([accountId, val]) => {
      const acc = getAccount(accounts, accountId);
      tableBody.push(["", `${acc?.code || ""} - ${acc?.name || ""}`, rawFormatCurrency(val)]);
    });
    Object.entries(profitLoss.nonOperatingExpenseByAccount).forEach(([accountId, val]) => {
      const acc = getAccount(accounts, accountId);
      tableBody.push(["", `${acc?.code || ""} - ${acc?.name || ""}`, `-${rawFormatCurrency(val)}`]);
    });
    tableBody.push(["", "Total Pendapatan/Beban Lain", { content: rawFormatCurrency(profitLoss.nonOperatingNet), styles: { fontStyle: "bold" as const } }]);
  }

  // VII. Laba Sebelum Pajak
  tableBody.push([{
    content: "VII. LABA SEBELUM PAJAK",
    colSpan: 2,
    styles: { fontStyle: "bold" as const, fillColor: [228, 228, 231] as [number, number, number] }
  }, {
    content: rawFormatCurrency(profitLoss.ebt),
    styles: { fontStyle: "bold" as const, fillColor: [228, 228, 231] as [number, number, number], halign: "right" as const }
  }]);

  // VIII. Pajak
  if (profitLoss.taxExpense > 0) {
    tableBody.push([{ content: "VIII. BEBAN PAJAK PENGHASILAN", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: grayBg } }]);
    Object.entries(profitLoss.taxByAccount).forEach(([accountId, val]) => {
      const acc = getAccount(accounts, accountId);
      tableBody.push(["", `${acc?.code || ""} - ${acc?.name || ""}`, `-${rawFormatCurrency(val)}`]);
    });
    tableBody.push(["", "Total Beban Pajak", { content: `-${rawFormatCurrency(profitLoss.taxExpense)}`, styles: { fontStyle: "bold" as const, textColor: [239, 68, 68] as [number, number, number] } }]);
  }

  // IX. Laba Bersih
  tableBody.push([{
    content: "IX. LABA BERSIH SETELAH PAJAK",
    colSpan: 2,
    styles: { fontStyle: "bold" as const, fillColor: [200, 250, 220] as [number, number, number] }
  }, {
    content: rawFormatCurrency(profitLoss.netProfit),
    styles: { fontStyle: "bold" as const, fillColor: [200, 250, 220] as [number, number, number], halign: "right" as const }
  }]);

  autoTable(doc, {
    body: tableBody,
    startY: 59,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 130 },
      2: { halign: "right" }
    },
    didParseCell: (data) => {
      if (data.cell.text[0]?.includes("Total") || data.row.index === tableBody.length - 1) {
        data.cell.styles.lineWidth = 0.3;
        data.cell.styles.lineColor = [150, 150, 150];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  addPdfSignature(doc, profile, finalY);
  doc.save(`KasFlow_Laba_Rugi_${year}_${profile.businessName.replace(/\s+/g, "_")}.pdf`);
}

export function exportBalanceSheetPDF(
  profile: BusinessProfile,
  year: number,
  balanceSheet: BalanceSheetReport
) {
  const doc = new jsPDF("p", "mm", "a4");
  addPdfHeader(doc, "Neraca Keuangan (Balance Sheet)", profile, year);

  const grayBg = [244, 244, 245] as [number, number, number];

  // Build left side (AKTIVA) rows
  const aktivaRows: Array<[string, string]> = [];
  aktivaRows.push(["A. Aset Lancar", ""]);
  for (const d of balanceSheet.asetLancarDetails) {
    aktivaRows.push([`   ${d.accountName}`, rawFormatCurrency(d.balance)]);
  }
  aktivaRows.push(["Subtotal Aset Lancar", rawFormatCurrency(balanceSheet.asetLancar)]);
  aktivaRows.push(["", ""]);
  aktivaRows.push(["B. Aset Tetap", ""]);
  for (const d of balanceSheet.asetTetapDetails) {
    aktivaRows.push([`   ${d.accountName}`, rawFormatCurrency(d.balance)]);
  }
  for (const d of balanceSheet.akumulasiPenyusutanDetails) {
    aktivaRows.push([`   ${d.accountName} (-)`, rawFormatCurrency(-d.balance)]);
  }
  aktivaRows.push(["Subtotal Aset Tetap", rawFormatCurrency(balanceSheet.asetTetap)]);

  // Build right side (PASIVA) rows
  const pasivaRows: Array<[string, string]> = [];
  pasivaRows.push(["C. Kewajiban Lancar", ""]);
  for (const d of balanceSheet.kewajibanLancarDetails) {
    pasivaRows.push([`   ${d.accountName}`, rawFormatCurrency(d.balance)]);
  }
  pasivaRows.push(["Subtotal Kewajiban Lancar", rawFormatCurrency(balanceSheet.kewajibanLancar)]);
  pasivaRows.push(["", ""]);
  pasivaRows.push(["D. Kewajiban Jangka Panjang", ""]);
  for (const d of balanceSheet.kewajibanJangkaPanjangDetails) {
    pasivaRows.push([`   ${d.accountName}`, rawFormatCurrency(d.balance)]);
  }
  pasivaRows.push(["Subtotal Kewajiban Jangka Panjang", rawFormatCurrency(balanceSheet.kewajibanJangkaPanjang)]);
  pasivaRows.push(["", ""]);
  pasivaRows.push(["E. Ekuitas", ""]);
  for (const d of balanceSheet.ekuitasDetails) {
    pasivaRows.push([`   ${d.accountName}`, rawFormatCurrency(d.balance)]);
  }
  pasivaRows.push(["Subtotal Ekuitas", rawFormatCurrency(balanceSheet.totalEkuitas)]);

  // Merge into side-by-side table
  const maxRows = Math.max(aktivaRows.length, pasivaRows.length);
  const tableBody: any[][] = [
    [{ content: "AKTIVA / ASET", colSpan: 2, styles: { fontStyle: "bold" as const, fillColor: grayBg } },
     { content: "PASIVA (KEWAJIBAN & EKUITAS)", colSpan: 2, styles: { fontStyle: "bold" as const, fillColor: grayBg } }],
  ];

  for (let i = 0; i < maxRows; i++) {
    const [aLabel, aVal] = aktivaRows[i] || ["", ""];
    const [pLabel, pVal] = pasivaRows[i] || ["", ""];
    const isSubtotal = aLabel.startsWith("Subtotal") || pLabel.startsWith("Subtotal");
    const row: any[] = [
      isSubtotal ? { content: aLabel, styles: { fontStyle: "bold" as const } } : aLabel,
      isSubtotal ? { content: aVal, styles: { fontStyle: "bold" as const } } : aVal,
      isSubtotal ? { content: pLabel, styles: { fontStyle: "bold" as const } } : pLabel,
      isSubtotal ? { content: pVal, styles: { fontStyle: "bold" as const } } : pVal,
    ];
    tableBody.push(row);
  }

  // Total row
  tableBody.push([
    { content: "TOTAL AKTIVA", styles: { fontStyle: "bold" as const } },
    { content: rawFormatCurrency(balanceSheet.totalAset), styles: { fontStyle: "bold" as const } },
    { content: "TOTAL PASIVA", styles: { fontStyle: "bold" as const } },
    { content: rawFormatCurrency(balanceSheet.totalKewajiban + balanceSheet.totalEkuitas), styles: { fontStyle: "bold" as const } },
  ]);

  autoTable(doc, {
    body: tableBody,
    startY: 59,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3.5 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { halign: "right" as const, cellWidth: 40, fontStyle: "bold" as const },
      2: { cellWidth: 50 },
      3: { halign: "right" as const, cellWidth: 40, fontStyle: "bold" as const }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Status Laporan Neraca: ${balanceSheet.isBalanced ? "SEIMBANG (BALANCED)" : "BELUM SEIMBANG (UNBALANCED)"}`, 15, finalY + 8);

  addPdfSignature(doc, profile, finalY + 6);
  doc.save(`KasFlow_Neraca_${year}_${profile.businessName.replace(/\s+/g, "_")}.pdf`);
}


// ── EXCEL BUNDLE EXPORT CHANNELS USING EXCELJS ──

// Helper style variables for ExcelJS (match Tailwind palette)
const colors = {
  headerBg: "18181B",    // zinc-900
  sectionBg: "E4E4E7",   // zinc-200
  totalBg: "F4F4F5",     // zinc-100
  white: "FFFFFF",
  mutedText: "71717A",   // zinc-500
  redText: "EF4444",     // red-500
  emeraldBg: "D1FAE5",   // emerald-100
  emeraldText: "059669", // emerald-600
  border: "D4D4D8",      // zinc-300
};

const borderStyles = {
  thin: { style: "thin" as const, color: { argb: "D4D4D8" } },
  double: { style: "double" as const, color: { argb: "71717A" } },
  medium: { style: "medium" as const, color: { argb: "71717A" } },
};

function formatHeaderBlock(sheet: ExcelJS.Worksheet, title: string, company: string, year: number, skema = "") {
  // Column sizing
  sheet.columns = [
    { width: 6 },  // A
    { width: 14 }, // B
    { width: 35 }, // C
    { width: 20 }, // D
    { width: 35 }, // E
    { width: 20 }, // F
    { width: 22 }  // G
  ];

  // Header Title
  sheet.mergeCells("A1:G1");
  const cell1 = sheet.getCell("A1");
  cell1.value = title.toUpperCase();
  cell1.font = { name: "Arial", size: 14, bold: true };
  cell1.alignment = { horizontal: "center" };

  // Company Name
  sheet.mergeCells("A2:G2");
  const cell2 = sheet.getCell("A2");
  cell2.value = company.toUpperCase();
  cell2.font = { name: "Arial", size: 12, bold: true };
  cell2.alignment = { horizontal: "center" };

  // Tax Period
  sheet.mergeCells("A3:G3");
  const cell3 = sheet.getCell("A3");
  cell3.value = `Tahun Pajak ${year}  |  Periode: 1 Januari – 31 Desember ${year}`;
  cell3.font = { name: "Arial", size: 10, italic: true };
  cell3.alignment = { horizontal: "center" };

  // Tax Scheme (conditional)
  if (skema) {
    sheet.mergeCells("A4:G4");
    const cell4 = sheet.getCell("A4");
    cell4.value = skema;
    cell4.font = { name: "Arial", size: 9, italic: true, color: { argb: colors.mutedText } };
    cell4.alignment = { horizontal: "center" };
  }
}

function formatMetadataBlock(sheet: ExcelJS.Worksheet, profile: BusinessProfile) {
  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  // Row 6
  sheet.getCell("A6").value = "NPWP Perusahaan :";
  sheet.getCell("A6").font = { name: "Arial", size: 9 };
  sheet.getCell("D6").value = profile.taxNumber || "10.000.000.1-710.277";
  sheet.getCell("D6").font = { name: "Arial", size: 9, bold: true };
  sheet.getCell("F6").value = "Tanggal Pelaporan :";
  sheet.getCell("F6").font = { name: "Arial", size: 9 };
  sheet.getCell("G6").value = dateStr;
  sheet.getCell("G6").font = { name: "Arial", size: 9, bold: true };

  // Row 7
  sheet.getCell("A7").value = "Penanggung Jawab :";
  sheet.getCell("A7").font = { name: "Arial", size: 9 };
  sheet.getCell("D7").value = profile.ownerName || "NOVIA SINATA";
  sheet.getCell("D7").font = { name: "Arial", size: 9, bold: true };

  // Row 8
  sheet.getCell("A8").value = "NPWP Penanggung Jawab :";
  sheet.getCell("A8").font = { name: "Arial", size: 9 };
  sheet.getCell("D8").value = "14.010.159.1-188.000";
  sheet.getCell("D8").font = { name: "Arial", size: 9, bold: true };

  // Row 9
  sheet.getCell("A9").value = "Mata Uang :";
  sheet.getCell("A9").font = { name: "Arial", size: 9 };
  sheet.getCell("D9").value = "IDR (Rupiah)";
  sheet.getCell("D9").font = { name: "Arial", size: 9, bold: true };
}

function formatSignatureBlock(sheet: ExcelJS.Worksheet, profile: BusinessProfile, startRow: number, year: number) {
  const row1 = startRow;
  const row2 = startRow + 1;
  const row7 = startRow + 6;

  sheet.getCell(`E${row1}`).value = `Pekanbaru, 20 April ${year + 1}`;
  sheet.getCell(`E${row1}`).font = { name: "Arial", size: 9 };
  sheet.getCell(`E${row2}`).value = "Penanggung Jawab,";
  sheet.getCell(`E${row2}`).font = { name: "Arial", size: 9, italic: true };

  sheet.getCell(`E${row7}`).value = profile.ownerName || "NOVIA SINATA";
  sheet.getCell(`E${row7}`).font = { name: "Arial", size: 9, bold: true, underline: true };
}

export async function exportAllReportsToExcel(
  profile: BusinessProfile,
  year: number,
  monthlyReports: { monthName: string; grossRevenue: number; tax: number; cumOmset: number; cumTax: number }[],
  profitLoss: ProfitLossReport,
  balanceSheet: BalanceSheetReport,
  accounts: Account[]
) {
  const wb = new ExcelJS.Workbook();

  // ──────────────────────────────────────────
  // SHEET 1: PEREDARAN BRUTO
  // ──────────────────────────────────────────
  const sBruto = wb.addWorksheet("Peredaran Bruto");
  sBruto.views = [{ showGridLines: true }];

  formatHeaderBlock(sBruto, "Laporan Peredaran Bruto (Omset) UMKM", profile.businessName, year, "Skema Perpajakan: PPh Final UMKM 0,5% (PP No. 23 Tahun 2018 jo. PP No. 55 Tahun 2022)");
  formatMetadataBlock(sBruto, profile);

  // Table Headers (Row 12)
  const brutoHeaders = ["No.", "Bulan", "Peredaran Bruto (Rp)", "PPh Final 0,5% (Rp)", "Kumulatif Omset (Rp)", "Kumulatif PPh (Rp)", "Keterangan"];
  const hRow = sBruto.getRow(12);
  hRow.values = brutoHeaders;
  hRow.height = 24;
  brutoHeaders.forEach((_, index) => {
    const cell = hRow.getCell(index + 1);
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: colors.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: borderStyles.thin, bottom: borderStyles.thin, left: borderStyles.thin, right: borderStyles.thin };
  });

  // Data rows (Row 13-24)
  monthlyReports.forEach((item, index) => {
    const rowNum = 13 + index;
    const r = sBruto.getRow(rowNum);
    r.height = 18;
    r.values = [
      index + 1,
      item.monthName,
      item.grossRevenue,
      item.tax,
      item.cumOmset,
      item.cumTax,
      "-"
    ];

    // Alignments & numbers formatting
    for (let c = 1; c <= 7; c++) {
      const cell = r.getCell(c);
      cell.font = { name: "Arial", size: 9 };
      cell.border = { top: borderStyles.thin, bottom: borderStyles.thin, left: borderStyles.thin, right: borderStyles.thin };

      if (c === 1) cell.alignment = { horizontal: "center" };
      if (c === 2) cell.font = { name: "Arial", size: 9, bold: true };
      if (c >= 3 && c <= 6) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right" };
      }
    }
  });

  // Total row (Row 25)
  const totalGross = monthlyReports.reduce((sum, item) => sum + item.grossRevenue, 0);
  const totalTax = monthlyReports.reduce((sum, item) => sum + item.tax, 0);

  const tRow = sBruto.getRow(25);
  tRow.height = 20;
  tRow.values = ["", `TOTAL TAHUN ${year}`, totalGross, totalTax, "-", "-", "Total setahun"];
  for (let c = 1; c <= 7; c++) {
    const cell = tRow.getCell(c);
    cell.font = { name: "Arial", size: 9, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.totalBg } };
    cell.border = { top: borderStyles.medium, bottom: borderStyles.double, left: borderStyles.thin, right: borderStyles.thin };

    if (c === 2) cell.alignment = { horizontal: "left" };
    if (c === 3 || c === 4) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: "right" };
    }
    if (c === 7) cell.alignment = { horizontal: "center" };
  }

  // Summary Metrics Rows (Row 27-28)
  sBruto.getCell("A27").value = "Total Peredaran Bruto / Omset (Rp)";
  sBruto.getCell("A27").font = { name: "Arial", size: 9, bold: true };
  sBruto.getCell("E27").value = totalGross;
  sBruto.getCell("E27").font = { name: "Arial", size: 9, bold: true };
  sBruto.getCell("E27").numFmt = '#,##0';
  sBruto.getCell("E27").alignment = { horizontal: "right" };

  sBruto.getCell("A28").value = "PPh Final UMKM 0,5% Terutang Setahun (Rp)";
  sBruto.getCell("A28").font = { name: "Arial", size: 9, bold: true };
  sBruto.getCell("E28").value = totalTax;
  sBruto.getCell("E28").font = { name: "Arial", size: 9, bold: true };
  sBruto.getCell("E28").numFmt = '#,##0';
  sBruto.getCell("E28").alignment = { horizontal: "right" };

  // Disclaimer Note (Row 31)
  sBruto.mergeCells("A31:G31");
  const noteCell = sBruto.getCell("A31");
  noteCell.value = "Catatan: PPh Final 0,5% dibayar tiap bulan paling lambat tgl 15 bulan berikutnya. Dasar hukum: PP No. 23 Tahun 2018 jo. PP No. 55 Tahun 2022. Berlaku untuk WP Badan (PT Perorangan) terdaftar 2024 — maksimal 4 tahun pajak.";
  noteCell.font = { name: "Arial", size: 8, italic: true, color: { argb: colors.mutedText } };
  noteCell.alignment = { wrapText: true };

  // Signature Block (Row 33-40)
  formatSignatureBlock(sBruto, profile, 33, year);


  // ──────────────────────────────────────────
  // SHEET 2: LAPORAN LABA RUGI
  // ──────────────────────────────────────────
  const sPL = wb.addWorksheet("Laba Rugi");
  sPL.views = [{ showGridLines: true }];

  formatHeaderBlock(sPL, "Laporan Laba Rugi", profile.businessName, year, "Skema Perpajakan: PPh Final UMKM 0,5% dari Peredaran Bruto (PP No. 23/2018)");
  formatMetadataBlock(sPL, profile);

  // Table Headers (Row 12)
  sPL.getRow(12).values = ["", "No.", "URAIAN", "TAHUN " + year];
  sPL.getRow(12).height = 20;
  for (let c = 2; c <= 4; c++) {
    const cell = sPL.getRow(12).getCell(c);
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: colors.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: borderStyles.thin, bottom: borderStyles.thin, left: borderStyles.thin, right: borderStyles.thin };
  }

  let currRow = 13;

  // 1. Revenue Section
  sPL.getCell(`A${currRow}`).value = "A.   PENDAPATAN";
  sPL.getCell(`A${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getRow(currRow).height = 18;
  currRow++;

  let revIndex = 1;
  Object.entries(profitLoss.revenueByAccount).forEach(([accountId, val]) => {
    const acc = getAccount(accounts, accountId);
    const r = sPL.getRow(currRow);
    r.height = 18;
    sPL.getCell(`B${currRow}`).value = `A.${revIndex}`;
    sPL.getCell(`C${currRow}`).value = acc?.name || "Pendapatan Usaha";
    sPL.getCell(`D${currRow}`).value = val;

    sPL.getCell(`B${currRow}`).alignment = { horizontal: "center" };
    sPL.getCell(`D${currRow}`).numFmt = '#,##0';
    sPL.getCell(`D${currRow}`).alignment = { horizontal: "right" };
    sPL.getCell(`C${currRow}`).font = { name: "Arial", size: 9 };
    sPL.getCell(`D${currRow}`).font = { name: "Arial", size: 9 };

    currRow++;
    revIndex++;
  });

  // Total Revenue Row
  sPL.getCell(`A${currRow}`).value = "TOTAL PENDAPATAN BERSIH";
  sPL.getCell(`A${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getCell(`D${currRow}`).value = profitLoss.revenue;
  sPL.getCell(`D${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getCell(`D${currRow}`).numFmt = '#,##0';
  sPL.getCell(`D${currRow}`).alignment = { horizontal: "right" };
  sPL.getCell(`D${currRow}`).border = { top: borderStyles.thin, bottom: borderStyles.double };
  sPL.getRow(currRow).height = 20;

  currRow += 2; // Add spacing

  // 2. HPP Section
  sPL.getCell(`A${currRow}`).value = "B.   HARGA POKOK PENJUALAN (HPP)";
  sPL.getCell(`A${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getRow(currRow).height = 18;
  currRow++;

  const hppItems = [
    ["B.1", "Persediaan Barang Awal Tahun (1 Jan " + year + ")", 0],
    ["B.2", "Pembelian Barang Dagangan (Neto)", 0],
    ["B.3", "Ongkos Angkut Pembelian", 0],
    ["B.4", "Barang Tersedia untuk Dijual", 0],
    ["B.5", "Persediaan Barang Akhir Tahun (31 Des " + year + ")", 0]
  ];

  hppItems.forEach(([no, label, val]) => {
    const r = sPL.getRow(currRow);
    r.height = 18;
    sPL.getCell(`B${currRow}`).value = no;
    sPL.getCell(`C${currRow}`).value = label;
    sPL.getCell(`D${currRow}`).value = val;

    sPL.getCell(`B${currRow}`).alignment = { horizontal: "center" };
    sPL.getCell(`D${currRow}`).numFmt = '#,##0';
    sPL.getCell(`D${currRow}`).alignment = { horizontal: "right" };
    sPL.getCell(`C${currRow}`).font = { name: "Arial", size: 9 };
    sPL.getCell(`D${currRow}`).font = { name: "Arial", size: 9 };
    currRow++;
  });

  // Total HPP Row
  sPL.getCell(`A${currRow}`).value = "TOTAL HPP";
  sPL.getCell(`A${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getCell(`D${currRow}`).value = 0; // Default HPP to 0
  sPL.getCell(`D${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getCell(`D${currRow}`).numFmt = '#,##0';
  sPL.getCell(`D${currRow}`).alignment = { horizontal: "right" };
  sPL.getCell(`D${currRow}`).border = { top: borderStyles.thin, bottom: borderStyles.double };
  sPL.getRow(currRow).height = 20;
  currRow++;

  // Laba Kotor
  sPL.getCell(`A${currRow}`).value = "LABA KOTOR  (Gross Profit)";
  sPL.getCell(`A${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getCell(`D${currRow}`).value = profitLoss.revenue; // Revenue - 0
  sPL.getCell(`D${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getCell(`D${currRow}`).numFmt = '#,##0';
  sPL.getCell(`D${currRow}`).alignment = { horizontal: "right" };
  sPL.getCell(`D${currRow}`).border = { top: borderStyles.thin, bottom: borderStyles.double };
  sPL.getRow(currRow).height = 20;

  currRow += 2;

  // 3. Expenses Section
  sPL.getCell(`A${currRow}`).value = "C.   BEBAN OPERASIONAL";
  sPL.getCell(`A${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getRow(currRow).height = 18;
  currRow++;

  let expIndex = 1;
  // Merge semua expense buckets (selling + admin + other operating)
  const allOperatingExpenses: Record<string, number> = {
    ...profitLoss.sellingByAccount,
    ...profitLoss.adminByAccount,
    ...profitLoss.otherOperatingByAccount,
  };
  Object.entries(allOperatingExpenses).forEach(([accountId, val]) => {
    const acc = getAccount(accounts, accountId);
    const r = sPL.getRow(currRow);
    r.height = 18;
    sPL.getCell(`B${currRow}`).value = `C.${expIndex}`;
    sPL.getCell(`C${currRow}`).value = acc?.name || "Beban Operasional";
    sPL.getCell(`D${currRow}`).value = val;

    sPL.getCell(`B${currRow}`).alignment = { horizontal: "center" };
    sPL.getCell(`D${currRow}`).numFmt = '#,##0';
    sPL.getCell(`D${currRow}`).alignment = { horizontal: "right" };
    sPL.getCell(`C${currRow}`).font = { name: "Arial", size: 9 };
    sPL.getCell(`D${currRow}`).font = { name: "Arial", size: 9 };

    currRow++;
    expIndex++;
  });

  // Total Expenses
  sPL.getCell(`A${currRow}`).value = "TOTAL BEBAN OPERASIONAL";
  sPL.getCell(`A${currRow}`).font = { name: "Arial", size: 9, bold: true };
  sPL.getCell(`D${currRow}`).value = profitLoss.totalOperatingExpenses;
  sPL.getCell(`D${currRow}`).font = { name: "Arial", size: 9, bold: true, color: { argb: colors.redText } };
  sPL.getCell(`D${currRow}`).numFmt = '#,##0';
  sPL.getCell(`D${currRow}`).alignment = { horizontal: "right" };
  sPL.getCell(`D${currRow}`).border = { top: borderStyles.thin, bottom: borderStyles.double };
  sPL.getRow(currRow).height = 20;
  currRow += 2;

  // Net Profit
  sPL.getCell(`A${currRow}`).value = "LABA BERSIH (Net Profit)";
  sPL.getCell(`A${currRow}`).font = { name: "Arial", size: 10, bold: true };
  sPL.getCell(`D${currRow}`).value = profitLoss.netProfit;
  sPL.getCell(`D${currRow}`).font = { name: "Arial", size: 10, bold: true };
  sPL.getCell(`D${currRow}`).numFmt = '#,##0';
  sPL.getCell(`D${currRow}`).alignment = { horizontal: "right" };
  sPL.getCell(`D${currRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.sectionBg } };
  sPL.getCell(`D${currRow}`).border = { top: borderStyles.medium, bottom: borderStyles.double };
  sPL.getRow(currRow).height = 22;
  currRow += 3;

  // Signature block
  formatSignatureBlock(sPL, profile, currRow, year);


  // ──────────────────────────────────────────
  // SHEET 3: NERACA KEUANGAN (SIDE-BY-SIDE)
  // ──────────────────────────────────────────
  const sNeraca = wb.addWorksheet("Neraca");
  sNeraca.views = [{ showGridLines: true }];

  // Column overrides for side-by-side neraca
  sNeraca.columns = [
    { width: 6 },  // A (No)
    { width: 10 }, // B (Kode)
    { width: 35 }, // C (Aset)
    { width: 20 }, // D (Jumlah)
    { width: 35 }, // E (Kewajiban)
    { width: 20 }, // F (Jumlah)
    { width: 5 }   // G (spacer)
  ];

  formatHeaderBlock(sNeraca, "Laporan Neraca / Balance Sheet", profile.businessName, year);
  formatMetadataBlock(sNeraca, profile);

  // Table Headers (Row 12)
  sNeraca.getRow(12).values = ["No.", "Kode", "ASET", "Jumlah (Rp)", "KEWAJIBAN & EKUITAS", "Jumlah (Rp)"];
  sNeraca.getRow(12).height = 22;
  for (let c = 1; c <= 6; c++) {
    const cell = sNeraca.getRow(12).getCell(c);
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: colors.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: borderStyles.thin, bottom: borderStyles.thin, left: borderStyles.thin, right: borderStyles.thin };
  }

  // Dynamic Neraca rows
  let nRow = 13;

  // Helper: write a section row
  function writeNeracaRow(row: number, aCode: string, aName: string, aVal: number, pName: string, pVal: number, bold = false) {
    sNeraca.getCell(`B${row}`).value = aCode;
    sNeraca.getCell(`C${row}`).value = aName;
    sNeraca.getCell(`D${row}`).value = aVal;
    sNeraca.getCell(`E${row}`).value = pName;
    sNeraca.getCell(`F${row}`).value = pVal;
    if (bold) {
      sNeraca.getCell(`A${row}`).font = { name: "Arial", size: 9, bold: true };
      sNeraca.getCell(`D${row}`).font = { name: "Arial", size: 9, bold: true };
      sNeraca.getCell(`D${row}`).border = { top: borderStyles.thin, bottom: borderStyles.thin };
      sNeraca.getCell(`E${row}`).font = { name: "Arial", size: 9, bold: true };
      sNeraca.getCell(`F${row}`).font = { name: "Arial", size: 9, bold: true };
      sNeraca.getCell(`F${row}`).border = { top: borderStyles.thin, bottom: borderStyles.thin };
    }
    sNeraca.getRow(row).height = 18;
  }

  // I. ASET LANCAR
  sNeraca.getCell(`A${nRow}`).value = "I.   ASET LANCAR";
  sNeraca.getCell(`A${nRow}`).font = { name: "Arial", size: 9, bold: true };
  sNeraca.getCell(`E${nRow}`).value = "I.   KEWAJIBAN LANCAR";
  sNeraca.getCell(`E${nRow}`).font = { name: "Arial", size: 9, bold: true };
  nRow++;

  for (const d of balanceSheet.asetLancarDetails) {
    writeNeracaRow(nRow, d.accountCode, d.accountName, d.balance, "", 0);
    nRow++;
  }
  // Fill kewajiban lancar on the right side
  const kewajibanLancarStart = 14;
  let kRow = kewajibanLancarStart;
  for (const d of balanceSheet.kewajibanLancarDetails) {
    sNeraca.getCell(`E${kRow}`).value = d.accountName;
    sNeraca.getCell(`F${kRow}`).value = d.balance;
    kRow++;
  }
  nRow = Math.max(nRow, kRow);

  writeNeracaRow(nRow, "", "Total Aset Lancar", balanceSheet.asetLancar, "Total Kewajiban Lancar", balanceSheet.kewajibanLancar, true);
  nRow += 2;

  // II. ASET TETAP
  sNeraca.getCell(`A${nRow}`).value = "II.  ASET TETAP";
  sNeraca.getCell(`A${nRow}`).font = { name: "Arial", size: 9, bold: true };
  sNeraca.getCell(`E${nRow}`).value = "II.  KEWAJIBAN JANGKA PANJANG";
  sNeraca.getCell(`E${nRow}`).font = { name: "Arial", size: 9, bold: true };
  nRow++;

  for (const d of balanceSheet.asetTetapDetails) {
    writeNeracaRow(nRow, d.accountCode, d.accountName, d.balance, "", 0);
    nRow++;
  }
  for (const d of balanceSheet.akumulasiPenyusutanDetails) {
    writeNeracaRow(nRow, d.accountCode, `${d.accountName} (-)`, -d.balance, "", 0);
    nRow++;
  }
  const kjpStart = nRow - balanceSheet.asetTetapDetails.length - balanceSheet.akumulasiPenyusutanDetails.length;
  let kjpRow = kjpStart;
  for (const d of balanceSheet.kewajibanJangkaPanjangDetails) {
    sNeraca.getCell(`E${kjpRow}`).value = d.accountName;
    sNeraca.getCell(`F${kjpRow}`).value = d.balance;
    kjpRow++;
  }
  nRow = Math.max(nRow, kjpRow);

  writeNeracaRow(nRow, "", "Total Aset Tetap", balanceSheet.asetTetap, "Total Kewajiban Jangka Panjang", balanceSheet.kewajibanJangkaPanjang, true);
  nRow += 2;

  // III. EKUITAS
  sNeraca.getCell(`E${nRow}`).value = "III. EKUITAS";
  sNeraca.getCell(`E${nRow}`).font = { name: "Arial", size: 9, bold: true };
  nRow++;

  for (const d of balanceSheet.ekuitasDetails) {
    writeNeracaRow(nRow, "", "", 0, d.accountName, d.balance);
    nRow++;
  }

  writeNeracaRow(nRow, "", "", 0, "Total Ekuitas", balanceSheet.totalEkuitas, true);
  nRow += 2;

  // TOTAL ASET / TOTAL PASIVA
  sNeraca.getCell(`A${nRow}`).value = "TOTAL ASET";
  sNeraca.getCell(`A${nRow}`).font = { name: "Arial", size: 10, bold: true };
  sNeraca.getCell(`D${nRow}`).value = balanceSheet.totalAset;
  sNeraca.getCell(`D${nRow}`).font = { name: "Arial", size: 10, bold: true };
  sNeraca.getCell(`D${nRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.sectionBg } };
  sNeraca.getCell(`D${nRow}`).border = { top: borderStyles.medium, bottom: borderStyles.double };

  sNeraca.getCell(`E${nRow}`).value = "TOTAL KEWAJIBAN & EKUITAS";
  sNeraca.getCell(`E${nRow}`).font = { name: "Arial", size: 10, bold: true };
  sNeraca.getCell(`F${nRow}`).value = balanceSheet.totalKewajiban + balanceSheet.totalEkuitas;
  sNeraca.getCell(`F${nRow}`).font = { name: "Arial", size: 10, bold: true };
  sNeraca.getCell(`F${nRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.sectionBg } };
  sNeraca.getCell(`F${nRow}`).border = { top: borderStyles.medium, bottom: borderStyles.double };
  sNeraca.getRow(nRow).height = 22;

  // Number formats for all grids in Neraca
  for (let r = 13; r <= nRow; r++) {
    const row = sNeraca.getRow(r);
    row.getCell(4).numFmt = '#,##0';
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(6).numFmt = '#,##0';
    row.getCell(6).alignment = { horizontal: "right" };

    row.getCell(1).font = row.getCell(1).font || { name: "Arial", size: 9 };
    row.getCell(3).font = row.getCell(3).font || { name: "Arial", size: 9 };
    row.getCell(5).font = row.getCell(5).font || { name: "Arial", size: 9 };

    if (row.getCell(2).value) row.getCell(2).alignment = { horizontal: "center" };
  }

  // Balance Check info
  const checkRow = nRow + 2;
  sNeraca.getCell(`A${checkRow}`).value = "Balance Check :";
  sNeraca.getCell(`A${checkRow}`).font = { name: "Arial", size: 9, bold: true };
  sNeraca.getCell(`D${checkRow}`).value = balanceSheet.isBalanced ? "✓ BALANCE — Selisih Rp 0" : "⚠ UNBALANCED — Perlu Penyesuaian";
  sNeraca.getCell(`D${checkRow}`).font = { name: "Arial", size: 9, bold: true, color: { argb: balanceSheet.isBalanced ? "10B981" : "EF4444" } };

  // Neraca Notes
  const noteRow = checkRow + 2;
  sNeraca.mergeCells(`A${noteRow}:G${noteRow}`);
  const bsNoteCell = sNeraca.getCell(`A${noteRow}`);
  bsNoteCell.value = `Catatan:\n1. Neraca disusun berdasarkan General Ledger per 31 Desember ${year}.\n2. Status keseimbangan Aset = Liabilitas + Ekuitas diverifikasi secara sistematis.`;
  bsNoteCell.font = { name: "Arial", size: 8, italic: true, color: { argb: colors.mutedText } };
  bsNoteCell.alignment = { wrapText: true };

  // Signature Block
  formatSignatureBlock(sNeraca, profile, noteRow + 3, year);


  // ──────────────────────────────────────────
  // DOWNLOAD STREAMING VIA BLOB
  // ──────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `KasFlow_Laporan_Keuangan_${year}_${profile.businessName.replace(/\s+/g, "_")}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
