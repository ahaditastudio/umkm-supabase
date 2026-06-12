import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getAccount } from "@/lib/accounting";
import type { Account, BusinessProfile, ProfitLossReport, BalanceSheetReport, TaxReport } from "@/lib/types";

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

  // Prevent overflow to next page for signature if too close to bottom
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

  doc.text(dateStr, 140, signatureY);
  doc.text("Penanggung Jawab,", 140, signatureY + 6);

  doc.setFont("helvetica", "bold");
  doc.text(profile.ownerName || "NOVIA SINATA", 140, signatureY + 25);

  doc.setFont("helvetica", "normal");
  doc.text(profile.businessType === "freelancer" ? "Freelancer" : "Direktur / Pemilik", 140, signatureY + 29);
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

  // Draw double line separator
  doc.setLineWidth(0.5);
  doc.line(15, 36, 195, 36);
  doc.setLineWidth(0.15);
  doc.line(15, 37, 195, 37);

  // Metadata block
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

  // Append Total Row
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
      // Bold the total row at the end
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        if (data.cell.section === "body") {
          data.cell.styles.fillColor = [244, 244, 245];
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // Law/tax notes under table
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

  // Revenue
  tableBody.push([{ content: "PENDAPATAN USAHA (REVENUE)", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: [244, 244, 245] as [number, number, number] } }]);
  Object.entries(profitLoss.revenueByAccount).forEach(([accountId, val]) => {
    const acc = getAccount(accounts, accountId);
    tableBody.push(["", `${acc?.code || ""} - ${acc?.name || ""}`, rawFormatCurrency(val)]);
  });
  tableBody.push(["", "Total Pendapatan Usaha", { content: rawFormatCurrency(profitLoss.revenue), styles: { fontStyle: "bold" as const } }]);

  // Expenses
  tableBody.push([{ content: "BEBAN & BIAYA OPERASIONAL (EXPENSES)", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: [244, 244, 245] as [number, number, number] } }]);
  Object.entries(profitLoss.expenseByAccount).forEach(([accountId, val]) => {
    const acc = getAccount(accounts, accountId);
    tableBody.push(["", `${acc?.code || ""} - ${acc?.name || ""}`, `-${rawFormatCurrency(val)}`]);
  });
  tableBody.push(["", "Total Beban & Biaya Operasional", { content: `-${rawFormatCurrency(profitLoss.expenses)}`, styles: { fontStyle: "bold" as const, textColor: [239, 68, 68] as [number, number, number] } }]);

  // Net Profit
  tableBody.push([{
    content: "LABA / (RUGI) BERSIH TAHUNAN (NET PROFIT)",
    colSpan: 2,
    styles: { fontStyle: "bold" as const, fillColor: [228, 228, 231] as [number, number, number] }
  }, {
    content: rawFormatCurrency(profitLoss.netProfit),
    styles: { fontStyle: "bold" as const, fillColor: [228, 228, 231] as [number, number, number], halign: "right" as const }
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
      // Add line borders under sections
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

  const tableBody = [
    [{ content: "AKTIVA / ASET", colSpan: 2, styles: { fontStyle: "bold" as const, fillColor: [244, 244, 245] as [number, number, number] } },
     { content: "PASIVA (KEWAJIBAN & EKUITAS)", colSpan: 2, styles: { fontStyle: "bold" as const, fillColor: [244, 244, 245] as [number, number, number] } }],

    ["Kas Utama & Bank", rawFormatCurrency(balanceSheet.assets), "Kewajiban Jangka Pendek", rawFormatCurrency(balanceSheet.liabilities)],
    ["Piutang & Aset Lancar Lain", "-", "Hutang Jangka Panjang", "-"],
    ["Aset Tetap (Kendaraan, Inventaris, Gedung)", "-", "Modal Disetor (Equity Base)", rawFormatCurrency(balanceSheet.equity - balanceSheet.retainedEarnings)],
    ["Akumulasi Penyusutan Aset", "-", "Laba Ditahan / Retained Earnings", rawFormatCurrency(balanceSheet.retainedEarnings)],

    [{ content: "TOTAL AKTIVA", styles: { fontStyle: "bold" as const } },
     { content: rawFormatCurrency(balanceSheet.assets), styles: { fontStyle: "bold" as const } },
     { content: "TOTAL PASIVA", styles: { fontStyle: "bold" as const } },
     { content: rawFormatCurrency(balanceSheet.liabilities + balanceSheet.equity), styles: { fontStyle: "bold" as const } }]
  ];

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


// ── EXCEL BUNDLE EXPORT CHANNELS ──

export function exportAllReportsToExcel(
  profile: BusinessProfile,
  year: number,
  monthlyReports: { monthName: string; grossRevenue: number; tax: number; cumOmset: number; cumTax: number }[],
  profitLoss: ProfitLossReport,
  balanceSheet: BalanceSheetReport,
  accounts: Account[]
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Peredaran Bruto
  const brutoRows = [
    ["LAPORAN PEREDARAN BRUTO (OMSET) UMKM"],
    [profile.businessName.toUpperCase()],
    [`Tahun Pajak ${year} | Periode: 1 Januari - 31 Desember ${year}`],
    ["Skema Perpajakan: PPh Final UMKM 0,5% (PP No. 55/2022)"],
    [],
    [`NPWP Perusahaan: ${profile.taxNumber || "-"}`, "", "", "", `Tanggal Pelaporan: ${new Date().toLocaleDateString("id-ID")}`],
    [`Penanggung Jawab: ${profile.ownerName || "-"}`, "", "", "", `Mata Uang: IDR (Rupiah)`],
    [],
    ["No.", "Bulan", "Peredaran Bruto (Rp)", "PPh Final 0,5% (Rp)", "Kumulatif Omset (Rp)", "Kumulatif PPh (Rp)", "Keterangan"]
  ];

  monthlyReports.forEach((item, index) => {
    brutoRows.push([
      (index + 1).toString(),
      item.monthName,
      item.grossRevenue.toString(),
      item.tax.toString(),
      item.cumOmset.toString(),
      item.cumTax.toString(),
      "-"
    ]);
  });

  const totalGross = monthlyReports.reduce((sum, item) => sum + item.grossRevenue, 0);
  const totalTax = monthlyReports.reduce((sum, item) => sum + item.tax, 0);

  brutoRows.push([
    "",
    "TOTAL TAHUN " + year,
    totalGross.toString(),
    totalTax.toString(),
    "-",
    "-",
    "Total Setahun"
  ]);

  const wsBruto = XLSX.utils.aoa_to_sheet(brutoRows);
  XLSX.utils.book_append_sheet(wb, wsBruto, "Peredaran Bruto 0.5%");

  // 2. Sheet Laba Rugi
  const plRows = [
    ["LAPORAN LABA RUGI (INCOME STATEMENT)"],
    [profile.businessName.toUpperCase()],
    [`Periode: 1 Januari - 31 Desember ${year}`],
    [],
    ["KODE AKUN", "NAMA REKENING", "NOMINAL (RP)"],
    ["PENDAPATAN USAHA (REVENUE)"]
  ];

  Object.entries(profitLoss.revenueByAccount).forEach(([accountId, val]) => {
    const acc = getAccount(accounts, accountId);
    plRows.push([acc?.code || "", acc?.name || "", val.toString()]);
  });
  plRows.push(["", "TOTAL PENDAPATAN USAHA", profitLoss.revenue.toString()]);
  plRows.push([]);
  plRows.push(["BEBAN & BIAYA OPERASIONAL (EXPENSES)"]);

  Object.entries(profitLoss.expenseByAccount).forEach(([accountId, val]) => {
    const acc = getAccount(accounts, accountId);
    plRows.push([acc?.code || "", acc?.name || "", `-${val}`]);
  });
  plRows.push(["", "TOTAL BEBAN & BIAYA OPERASIONAL", `-${profitLoss.expenses}`]);
  plRows.push([]);
  plRows.push(["", "LABA / (RUGI) BERSIH", profitLoss.netProfit.toString()]);

  const wsPL = XLSX.utils.aoa_to_sheet(plRows);
  XLSX.utils.book_append_sheet(wb, wsPL, "Laba Rugi");

  // 3. Sheet Neraca
  const bsRows = [
    ["NERACA KEUANGAN (BALANCE SHEET)"],
    [profile.businessName.toUpperCase()],
    [`Per tanggal 31 Desember ${year}`],
    [],
    ["AKTIVA", "NOMINAL (RP)", "", "PASIVA", "NOMINAL (RP)"],
    ["Kas Utama & Bank", balanceSheet.assets.toString(), "", "Kewajiban Jangka Pendek", balanceSheet.liabilities.toString()],
    ["Piutang Usaha", "-", "", "Hutang Jangka Panjang", "-"],
    ["Aset Tetap", "-", "", "Modal Disetor", (balanceSheet.equity - balanceSheet.retainedEarnings).toString()],
    ["Akumulasi Penyusutan", "-", "", "Laba Ditahan", balanceSheet.retainedEarnings.toString()],
    ["TOTAL AKTIVA", balanceSheet.assets.toString(), "", "TOTAL PASIVA", (balanceSheet.liabilities + balanceSheet.equity).toString()]
  ];

  const wsBS = XLSX.utils.aoa_to_sheet(bsRows);
  XLSX.utils.book_append_sheet(wb, wsBS, "Neraca");

  // Write file
  XLSX.writeFile(wb, `KasFlow_Laporan_Keuangan_${year}_${profile.businessName.replace(/\s+/g, "_")}.xlsx`);
}
