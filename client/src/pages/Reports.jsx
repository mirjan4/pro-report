import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import { FileText, Download, Award, Calendar, FileSpreadsheet, Sparkles, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const Reports = () => {
  const { selectedFY } = useApp();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  useEffect(() => {
    const fetchReportData = async () => {
      if (!selectedFY?._id) return;
      setLoading(true);
      try {
        const res = await client.get(`/api/reports/full-data?financialYear=${selectedFY._id}`);
        if (res.data.success) {
          setReportData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load report data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReportData();
  }, [selectedFY]);

  // Generate Excel report
  const downloadExcelReport = () => {
    if (!reportData) return;
    setDownloadingExcel(true);
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: PRO Summary
      const proData = reportData.proSummaries.map(p => ({
        Rank: p.rank,
        Name: p.name,
        Region: p.area,
        Status: p.status,
        'Global Contribution (INR)': p.global,
        'PRO Contribution (INR)': p.pro,
        'Office Contribution (INR)': p.office,
        'Total Contribution (INR)': p.total
      }));
      const proSheet = XLSX.utils.json_to_sheet(proData);
      XLSX.utils.book_append_sheet(workbook, proSheet, 'PRO Performance');

      // Sheet 2: Monthly Totals
      const monthlyData = reportData.monthlyTotals.map(m => ({
        Month: m.month,
        'Global Share (INR)': m.global,
        'PRO Share (INR)': m.pro,
        'Office Share (INR)': m.office,
        'Total Monthly (INR)': m.total
      }));
      const monthlySheet = XLSX.utils.json_to_sheet(monthlyData);
      XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Distribution');

      // Sheet 3: Grand Totals
      const grandData = [
        {
          Category: 'Global',
          Amount: reportData.grandTotal.global
        },
        {
          Category: 'PRO',
          Amount: reportData.grandTotal.pro
        },
        {
          Category: 'Office',
          Amount: reportData.grandTotal.office
        },
        {
          Category: 'Grand Total',
          Amount: reportData.grandTotal.total
        }
      ];
      const grandSheet = XLSX.utils.json_to_sheet(grandData);
      XLSX.utils.book_append_sheet(workbook, grandSheet, 'Grand Summary');

      XLSX.writeFile(workbook, `Takaful_Financial_Report_${reportData.fyYear}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate Excel report');
    } finally {
      setDownloadingExcel(false);
    }
  };

  // Generate PDF report
  const downloadPDFReport = () => {
    if (!reportData) return;
    setDownloadingPDF(true);
    try {
      const doc = new jsPDF();

      // Cover Title Header
      doc.setFillColor(10, 15, 30);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(245, 197, 24);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('TAKAFUL COLLECTION REPORT', 14, 18);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${reportData.fyLabel}  |  Generated on ${new Date(reportData.generatedAt).toLocaleString()}`, 14, 28);

      // Section 1: Financial Performance Summary
      doc.setTextColor(10, 15, 30);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('I. Executive Summary Metrics', 14, 52);

      const summaryRows = [
        ['Total Takaful Collections', `INR ${reportData.grandTotal.total.toLocaleString('en-IN')}`],
        ['Global Contribution Share', `INR ${reportData.grandTotal.global.toLocaleString('en-IN')}`],
        ['PRO Contribution Share', `INR ${reportData.grandTotal.pro.toLocaleString('en-IN')}`],
        ['Office Contribution Share', `INR ${reportData.grandTotal.office.toLocaleString('en-IN')}`]
      ];

      doc.autoTable({
        body: summaryRows,
        startY: 56,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', width: 100 } }
      });

      // Section 2: PRO Ranking Table
      const finalY = doc.lastAutoTable.finalY || 56;
      doc.setFontSize(14);
      doc.text('II. PRO Performance Rankings', 14, finalY + 16);

      const proHeaders = ['Rank', 'PRO Name', 'Region', 'Status', 'Global', 'PRO', 'Office', 'Total (INR)'];
      const proRows = reportData.proSummaries.map(p => [
        p.rank,
        p.name,
        p.area,
        p.status,
        p.global.toLocaleString('en-IN'),
        p.pro.toLocaleString('en-IN'),
        p.office.toLocaleString('en-IN'),
        p.total.toLocaleString('en-IN')
      ]);

      doc.autoTable({
        head: [proHeaders],
        body: proRows,
        startY: finalY + 22,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 27, 42] }
      });

      // Page break for Monthly distribution
      doc.addPage();

      // Cover Header for page 2
      doc.setFillColor(10, 15, 30);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(`Takaful Financial Report - Monthly Distribution`, 14, 13);

      doc.setTextColor(10, 15, 30);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('III. Monthly Distribution Overview', 14, 35);

      const monthHeaders = ['Month', 'Global (INR)', 'PRO Share (INR)', 'Office (INR)', 'Total Amount (INR)'];
      const monthRows = reportData.monthlyTotals.map(m => [
        m.month,
        m.global.toLocaleString('en-IN'),
        m.pro.toLocaleString('en-IN'),
        m.office.toLocaleString('en-IN'),
        m.total.toLocaleString('en-IN')
      ]);

      doc.autoTable({
        head: [monthHeaders],
        body: monthRows,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [13, 27, 42] }
      });

      doc.save(`Takaful_Financial_Report_${reportData.fyYear}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF report');
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Reports <span className="gold-gradient-text">Module</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Generate, compile, and export official financial reporting statements in one click — {selectedFY?.label}
        </p>
      </div>

      {/* Control panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Download Card */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 bg-red-500/10 text-red-400 rounded-bl-2xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Export Official PDF</h3>
            <p className="text-sm text-gray-400 max-w-[280px]">
              Downloads a high-fidelity formatted document with executive summary, rankings, and monthly distribution tables.
            </p>
          </div>
          <button
            onClick={downloadPDFReport}
            disabled={downloadingPDF}
            className="w-full mt-6 py-3.5 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg font-bold rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-gold/20 hover:shadow-gold/30 hover:scale-[1.01] active:scale-[0.99] transition-all glow-btn"
          >
            {downloadingPDF ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-dark-bg border-t-transparent" />
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download PDF Statement</span>
              </>
            )}
          </button>
        </div>

        {/* Excel Download Card */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 bg-emerald-500/10 text-emerald-400 rounded-bl-2xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Export Raw Excel Dataset</h3>
            <p className="text-sm text-gray-400 max-w-[280px]">
              Downloads a spreadsheet with separate sheets for PRO rankings, monthly contributions, and grand summary metrics.
            </p>
          </div>
          <button
            onClick={downloadExcelReport}
            disabled={downloadingExcel}
            className="w-full mt-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-gold border border-gold/30 font-bold rounded-xl flex items-center justify-center space-x-2 transition-all"
          >
            {downloadingExcel ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-gold border-t-transparent" />
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Excel Sheet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Brief Preview Registry */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Sparkles className="w-5 h-5 mr-2 text-gold" />
          Executive Summary Report Preview
        </h3>
        {reportData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Financial Year</span>
              <span className="text-lg font-bold text-white mt-1 block">{reportData.fyYear}</span>
            </div>
            <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Grand Total Collection</span>
              <span className="text-lg font-bold text-gold mt-1 block">₹{reportData.grandTotal.total.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Contributing PRO Officers</span>
              <span className="text-lg font-bold text-white mt-1 block">{reportData.proSummaries.filter(p => p.total > 0).length} Officers</span>
            </div>
            <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Generation Time</span>
              <span className="text-lg font-bold text-white mt-1 block">{new Date(reportData.generatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
