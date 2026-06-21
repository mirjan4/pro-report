import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import { 
  FileText, Download, Award, Calendar, FileSpreadsheet, 
  Sparkles, CheckCircle, Sliders, CalendarDays, AlertTriangle,
  Printer, TrendingUp, DollarSign, Users, RefreshCw, Share2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];

const Reports = () => {
  const { financialYears, selectedFY, selectedModule, modules, setSelectedModule } = useApp();
  
  // Filtering Criteria
  const [periodType, setPeriodType] = useState('fy'); // 'month', 'year', 'fy', 'custom'
  
  // Period values
  const [selectedMonth, setSelectedMonth] = useState('April');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedFYId, setSelectedFYId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Report details state
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Sync default financial year
  useEffect(() => {
    if (selectedFY?._id) {
      if (selectedFY._id !== 'all') {
        setSelectedFYId(selectedFY._id);
      } else {
        const activeFY = financialYears.find(fy => fy.isActive);
        if (activeFY) setSelectedFYId(activeFY._id);
      }
    }
  }, [selectedFY, financialYears]);

  // Fetch Report Data
  const fetchReport = async () => {
    if (periodType === 'custom' && (!fromDate || !toDate)) {
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('periodType', periodType);

      if (selectedModule && selectedModule.code !== 'all') {
        params.append('module', selectedModule._id);
      }

      if (periodType === 'month') {
        params.append('month', selectedMonth);
        params.append('year', selectedYear);
      } else if (periodType === 'year') {
        params.append('year', selectedYear);
      } else if (periodType === 'fy') {
        const fyObj = financialYears.find(fy => fy._id === selectedFYId);
        const startYr = fyObj ? fyObj.startYear : new Date().getFullYear();
        params.append('financialYear', startYr);
      } else if (periodType === 'custom') {
        params.append('fromDate', fromDate);
        params.append('toDate', toDate);
      }

      const res = await client.get(`/api/reports/generate?${params.toString()}`);
      if (res.data.success) {
        setReport(res.data.data);
      }
    } catch (err) {
      console.error('Failed to generate report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [periodType, selectedMonth, selectedYear, selectedFYId, fromDate, toDate, selectedModule]);

  // EXPORT TO EXCEL
  const handleExportExcel = () => {
    if (!report) return;
    setExportingExcel(true);
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Management Summary
      const sheet1AOA = [
        [report.title],
        [report.subtitle],
        [],
        ['NEW SPONSORS ADDED'],
        ['Sponsor Tier', 'Count'],
        ['Premium', report.sponsorsSummary.premium],
        ['Smart', report.sponsorsSummary.smart],
        ['Standard', report.sponsorsSummary.standard],
        ['Total New Sponsors', report.sponsorsSummary.total],
        [],
        ['SPONSORS ADDED BY PRO / OFFICE'],
        ['PRO / Office Recruiter', 'Sponsors Count'],
        ...report.sponsorsByRecruiter.map(s => [s.name, s.count]),
        [],
        ['COLLECTION SUMMARY'],
        ['Collection Source', 'Amount'],
        ['Global Collection', report.collectionSummary.global],
        ['PRO Collection', report.collectionSummary.pro],
        ['Office Collection', report.collectionSummary.office],
        ['Total Collection', report.collectionSummary.total],
        [],
        ['ALLOCATED PROJECT DISTRIBUTIONS'],
        ['Head', 'Amount'],
        ...((() => {
          const remaining = report.collectionDistribution?.remainingTakafulBalance || 0;
          return [
            { head: 'Takaful', amount: remaining },
            ...(report.collectionDistribution?.distributions || [])
          ].filter(item => item.amount > 0).map(item => [item.head, item.amount]);
        })()),
        [],
        ['GRAND TOTAL'],
        ['Total Collection', report.collectionSummary.total],
        ['Direct Collections Through PROs', report.additionalSubtotal],
        ['Grand Total', report.grandTotal]
      ];
      
      const sheet1 = XLSX.utils.aoa_to_sheet(sheet1AOA);
      XLSX.utils.book_append_sheet(workbook, sheet1, 'Management Summary');

      // Sheet 2: Collection Distribution
      const remaining = report.collectionDistribution?.remainingTakafulBalance || 0;
      const distAOA = [
        ['TAKAFUL DISTRIBUTION REPORT'],
        [report.subtitle],
        [],
        ['Head', 'Amount'],
        ['Takaful', remaining],
        ...(report.collectionDistribution?.distributions || []).filter(d => d.amount > 0).map(d => [d.head, d.amount])
      ];
      
      const distSheet = XLSX.utils.aoa_to_sheet(distAOA);
      XLSX.utils.book_append_sheet(workbook, distSheet, 'Collection Distribution');

      // Sheet 4: Detailed Direct Collections (Pivot)
      if (report.additionalPivotRows && report.additionalPivotRows.length > 0) {
        const sheet3AOA = [
          ['DIRECT COLLECTIONS RECEIVED THROUGH PROs'],
          [report.subtitle],
          [],
          ['PRO Name', ...report.additionalColumns, 'Total Amount'],
          ...report.additionalPivotRows.map(r => {
            const rowTotal = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
            return [
              r.proName,
              ...report.additionalColumns.map(col => r[col] || 0),
              rowTotal
            ];
          }),
          [],
          ['Total PROs', report.additionalPivotRows.length, 'Total Direct Collections', report.additionalSubtotal]
        ];

        const sheet3 = XLSX.utils.aoa_to_sheet(sheet3AOA);
        XLSX.utils.book_append_sheet(workbook, sheet3, 'Detailed Direct Collections');
      }

      // Sheet 3: Detailed Collection Report
      const sortedRows = [...report.detailedReport.rows].sort((a, b) => b.amount - a.amount);
      const sheet2AOA = [
        [report.detailedReport.title],
        [report.subtitle],
        [],
        report.collectionFilterCode === 'all'
          ? ['Category', 'Collection Amount', 'Contribution %']
          : ['PRO Name', 'Collection Amount', 'Contribution %', 'Status'],
        ...sortedRows.map(r => {
          if (report.collectionFilterCode === 'all') {
            return [r.name, r.amount, `${r.pct}%`];
          } else {
            return [r.name, r.amount, `${r.pct}%`, r.status];
          }
        }),
        [],
        ['Total Contributors', report.detailedReport.totalContributors, 'Total Collection', report.detailedReport.totalCollection]
      ];

      const sheet2 = XLSX.utils.aoa_to_sheet(sheet2AOA);
      XLSX.utils.book_append_sheet(workbook, sheet2, 'Detailed Collection Report');

      const fileFilter = selectedModule ? selectedModule.name.replace(/\s+/g, '_') : 'All';
      XLSX.writeFile(workbook, `Takaful_Report_${report.subtitle.replace(/[^a-zA-Z0-9]/g, '_')}_${fileFilter}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate Excel sheets');
    } finally {
      setExportingExcel(false);
    }
  };

  // EXPORT TO PDF
  const handleExportPDF = () => {
    if (!report) return;
    setExportingPDF(true);
    try {
      const totalPages = (report.additionalPivotRows && report.additionalPivotRows.length > 0 ? 3 : 2) + 1;
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // =========================================================================
      // PAGE 1: Management Summary Report
      // =========================================================================
      
      // Top accent banner
      doc.setFillColor(10, 15, 30);
      doc.rect(0, 0, 210, 35, 'F');

      // Title
      doc.setTextColor(245, 197, 24); // gold
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(report.title, 15, 14);

      // Subtitle
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(report.subtitle, 15, 20);

      // Reduced banner height - no metadata line
      // (metadata line removed per cleanup)

      // Set starting height for side-by-side tables
      let y1 = 45;

      // New Sponsors Added (Left Column)
      doc.setTextColor(10, 15, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('NEW SPONSORS ADDED', 15, y1 - 2);

      const sponsorsRows = [
        ['Premium Tier', String(report.sponsorsSummary.premium)],
        ['Smart Tier', String(report.sponsorsSummary.smart)],
        ['Standard Tier', String(report.sponsorsSummary.standard)],
        ['Total New Sponsors', String(report.sponsorsSummary.total)]
      ];

      doc.autoTable({
        body: sponsorsRows,
        startY: y1,
        margin: { left: 15 },
        tableWidth: 85,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: { 0: { fontStyle: 'normal' }, 1: { fontStyle: 'bold', halign: 'right' } },
        didParseCell: function(data) {
          if (data.row.index === 3) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 245];
          }
        }
      });
      const yLeft1 = doc.lastAutoTable.finalY;

      // Collection Summary (Right Column)
      doc.setTextColor(10, 15, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('COLLECTION SUMMARY', 110, y1 - 2);

      const collectionRows = [
        ['Global Collection', '₹' + report.collectionSummary.global.toLocaleString('en-IN')],
        ['PRO Collection', '₹' + report.collectionSummary.pro.toLocaleString('en-IN')],
        ['Office Collection', '₹' + report.collectionSummary.office.toLocaleString('en-IN')],
        ['Total Collection', '₹' + report.collectionSummary.total.toLocaleString('en-IN')]
      ];

      doc.autoTable({
        body: collectionRows,
        startY: y1,
        margin: { left: 110 },
        tableWidth: 85,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: { 0: { fontStyle: 'normal' }, 1: { fontStyle: 'bold', halign: 'right' } },
        didParseCell: function(data) {
          if (data.row.index === 3) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 245];
          }
        }
      });
      const yRight1 = doc.lastAutoTable.finalY;

      // Section 2 and Section 4 starting Y
      const y2 = Math.max(yLeft1, yRight1) + 8;

      // Sponsors Added by PRO / Office (Left Column)
      doc.setTextColor(10, 15, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('SPONSORS ADDED BY RECRUITER', 15, y2 - 2);

      const recruitersRows = report.sponsorsByRecruiter.length > 0 
        ? report.sponsorsByRecruiter.slice(0, 8).map(s => [s.name, String(s.count)])
        : [['No sponsors added', '0']];

      doc.autoTable({
        head: [['PRO / Office Recruiter', 'Sponsors']],
        body: recruitersRows,
        startY: y2,
        margin: { left: 15 },
        tableWidth: 85,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [13, 27, 42], fontSize: 8 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
      });
      const yLeft2 = doc.lastAutoTable.finalY;

      // Allocated Project Distributions (Right Column)
      doc.setTextColor(10, 15, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ALLOCATED PROJECT DISTRIBUTIONS', 110, y2 - 2);

      const distRemaining = report.collectionDistribution?.remainingTakafulBalance || 0;
      const allocRows = [
        { head: 'Takaful', amount: distRemaining },
        ...(report.collectionDistribution?.distributions || [])
      ]
        .filter(item => item.amount > 0)
        .slice(0, 8)
        .map(item => [item.head, '₹' + item.amount.toLocaleString('en-IN')]);

      const allocRowsFinal = allocRows.length > 0 ? allocRows : [['No distributions recorded', '₹0']];

      doc.autoTable({
        head: [['Head', 'Amount']],
        body: allocRowsFinal,
        startY: y2,
        margin: { left: 110 },
        tableWidth: 85,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [13, 27, 42], fontSize: 8 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
      });
      const yRight2 = doc.lastAutoTable.finalY;

      // Rankings and Grand Total Section
      const yRankings = Math.max(yLeft2, yRight2) + 8;
      let yRankingsEnd = yRankings;

      if (report.additionalPivotRows && report.additionalPivotRows.length > 0) {
        // Direct Collections Received Through PROs
        doc.setTextColor(10, 15, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('DIRECT COLLECTIONS RECEIVED THROUGH PROs', 15, yRankings - 2);

        const pivotHeaders = [['PRO Name', ...report.additionalColumns, 'Total Amount']];
        const pivotRows = report.additionalPivotRows.slice(0, 6).map(r => {
          const rowTotal = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
          return [
            r.proName,
            ...report.additionalColumns.map(col => '₹' + (r[col] || 0).toLocaleString('en-IN')),
            '₹' + rowTotal.toLocaleString('en-IN')
          ];
        });

        doc.autoTable({
          head: pivotHeaders,
          body: pivotRows,
          startY: yRankings,
          margin: { left: 15 },
          tableWidth: 180,
          theme: 'striped',
          styles: { fontSize: 6.5, cellPadding: 1.5 },
          headStyles: { fillColor: [13, 27, 42] },
          columnStyles: { 
            0: { fontStyle: 'bold' },
            ...report.additionalColumns.reduce((acc, col, idx) => {
              acc[idx + 1] = { halign: 'right' };
              return acc;
            }, {}),
            [report.additionalColumns.length + 1]: { halign: 'right', fontStyle: 'bold' }
          }
        });
        yRankingsEnd = doc.lastAutoTable.finalY;
      }

      // Grand Total Highlight Box
      const yGrandTotal = (report.additionalPivotRows && report.additionalPivotRows.length > 0 ? yRankingsEnd : yRankings) + 4;
      doc.setFillColor(13, 27, 42); // Deep Navy background
      
      if (report.additionalSubtotal > 0) {
        doc.rect(15, yGrandTotal, 180, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total Collection: ₹${report.collectionSummary.total.toLocaleString('en-IN')}   |   Direct Collections Through PROs: ₹${report.additionalSubtotal.toLocaleString('en-IN')}`, 20, yGrandTotal + 5);
        
        doc.setTextColor(245, 197, 24); // gold
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`GRAND TOTAL = ₹${report.grandTotal.toLocaleString('en-IN')}`, 20, yGrandTotal + 12);
      } else {
        doc.rect(15, yGrandTotal, 180, 12, 'F');
        doc.setTextColor(245, 197, 24); // gold
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`GRAND TOTAL = ₹${report.grandTotal.toLocaleString('en-IN')}`, 20, yGrandTotal + 7.5);
      }

      // Page 1 Footer
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page 1 of ${totalPages}`, 195, 285, { align: 'right' });


      // =========================================================================
      // PAGE 2: Collection Distribution Report
      // =========================================================================
      doc.addPage();

      // Page 2 header band
      doc.setFillColor(10, 15, 30);
      doc.rect(0, 0, 210, 25, 'F');

      // Title
      doc.setTextColor(245, 197, 24);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TAKAFUL DISTRIBUTION', 15, 11);

      // Period metadata
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Period: ${report.subtitle}`, 15, 18);

      // Allocated Project Distributions Table
      doc.setTextColor(10, 15, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ALLOCATED PROJECT DISTRIBUTIONS', 15, 30);

      const remaining = report.collectionDistribution?.remainingTakafulBalance || 0;
      const distRows = [
        { head: 'Takaful', amount: remaining },
        ...(report.collectionDistribution?.distributions || [])
      ]
        .filter(item => item.amount > 0)
        .map(item => [item.head, '₹' + item.amount.toLocaleString('en-IN')]);

      if (distRows.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text('No distribution records available for the selected period.', 15, 37);
      } else {
        const distHeaders = [['Head', 'Amount']];
        doc.autoTable({
          head: distHeaders,
          body: distRows,
          startY: 32,
          margin: { left: 15 },
          tableWidth: 180,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [13, 27, 42] },
          columnStyles: { 
            0: { fontStyle: 'normal' },
            1: { halign: 'right', fontStyle: 'bold' }
          }
        });
      }

      // Page 2 Footer
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page 2 of ${totalPages}`, 195, 285, { align: 'right' });


      // =========================================================================
      // PAGE 3: Detailed Collection Report
      // =========================================================================
      doc.addPage();

      // Page 3 header band
      doc.setFillColor(10, 15, 30);
      doc.rect(0, 0, 210, 25, 'F');

      // Title
      doc.setTextColor(245, 197, 24);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(report.detailedReport.title, 15, 11);

      // Period metadata
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Period: ${report.subtitle}`, 15, 18);

      const detailedHeaders = report.collectionFilterCode === 'all'
        ? [['Category', 'Collection Amount', 'Contribution %']]
        : [['PRO Name', 'Collection Amount', 'Contribution %', 'Status']];

      const sortedDetailedRows = [...report.detailedReport.rows].sort((a, b) => b.amount - a.amount);
      const detailedRows = sortedDetailedRows.map(r => {
        if (report.collectionFilterCode === 'all') {
          return [r.name, '₹' + r.amount.toLocaleString('en-IN'), `${r.pct}%`];
        } else {
          return [r.name, '₹' + r.amount.toLocaleString('en-IN'), `${r.pct}%`, r.status.toUpperCase()];
        }
      });

      doc.autoTable({
        head: detailedHeaders,
        body: detailedRows,
        startY: 32,
        margin: { left: 15 },
        tableWidth: 180,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [13, 27, 42] },
        columnStyles: { 
          0: { fontStyle: 'bold' },
          1: { halign: 'right', fontStyle: 'bold' },
          2: { halign: 'right' }
        }
      });

      const yDetailedEnd = doc.lastAutoTable.finalY || 200;

      // Table Footer summary
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yDetailedEnd + 2, 180, 10, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Contributors: ${report.detailedReport.totalContributors}`, 20, yDetailedEnd + 8);
      doc.text(`Total Collection: ₹${report.detailedReport.totalCollection.toLocaleString('en-IN')}`, 190, yDetailedEnd + 8, { align: 'right' });

      // Page 3 Footer
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page 3 of ${totalPages}`, 195, 285, { align: 'right' });



      doc.save(`Takaful_Report_${report.subtitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  // TRIGGER BROWSER PRINT
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Print Page Styles Override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          aside, header, nav, .no-print, button, select, input, label, .debug-panel {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          .print-container {
            width: 210mm !important;
            min-height: 297mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            padding: 15mm !important;
            margin: 0 auto 20mm auto !important;
            box-sizing: border-box !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          /* Clean borders and typography for white paper print out */
          .print-container * {
            color: black !important;
            border-color: #ccc !important;
          }
          .print-container text, .print-container span, .print-container div, .print-container td {
            color: black !important;
          }
          .print-container th {
            background-color: #f3f4f6 !important;
            color: black !important;
            border-bottom: 2px solid #000 !important;
          }
          .print-container table, .print-container th, .print-container td {
            border: 1px solid #ccc !important;
          }
          .print-grand-total {
            border: 2px solid #000 !important;
            background-color: #f9fafb !important;
            padding: 15px !important;
            color: black !important;
          }
          .print-grand-total * {
            color: black !important;
          }
        }
      `}} />

      {/* Title */}
      <div className="no-print">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-white">
            Reports <span className="gold-gradient-text">Generator Hub</span>
          </h1>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            Report Builder
          </span>
        </div>
        <p className="text-gray-400 text-sm mt-1">
          Compile, preview, print, or export multi-period financial & sponsor recruiting statements.
        </p>
      </div>

      {/* Filters Setup Card */}
      <div className="glass-card rounded-2xl p-6 space-y-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
          <h2 className="text-md font-bold text-white flex items-center">
            <Sliders className="w-5 h-5 text-gold mr-2.5" />
            Report Criteria Setup
          </h2>
          {/* Period Type Buttons */}
          <div className="flex flex-wrap bg-[#0a0f1d] border border-white/10 rounded-xl p-1 shrink-0 gap-1">
            {[
              { id: 'month', label: 'Monthly' },
              { id: 'year', label: 'Yearly' },
              { id: 'fy', label: 'Financial Year' },
              { id: 'custom', label: 'Custom Range' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodType(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodType === p.id ? 'bg-gold text-dark-bg font-extrabold shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Period Inputs & Category selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Category/Collection Filter */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-gold" />
              Collection Filter
            </label>
            <select
              value={selectedModule?._id || 'all'}
              onChange={e => {
                const mod = modules.find(m => m._id === e.target.value);
                if (mod) setSelectedModule(mod);
              }}
              className="w-full bg-[#0a0f1d] border border-white/10 hover:border-gold/30 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors cursor-pointer"
            >
              {modules.map(mod => (
                <option key={mod._id} value={mod._id} style={{ color: mod.color }}>
                  {mod.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Contextual Period Selectors */}
          {periodType === 'month' && (
            <>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gold" />
                  Select Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/10 hover:border-gold/30 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors cursor-pointer"
                >
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-gold" />
                  Select Year
                </label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  min="2000" max="2100"
                  className="w-full bg-[#0a0f1d] border border-white/10 hover:border-gold/30 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </>
          )}

          {periodType === 'year' && (
            <div className="flex flex-col col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-gold" />
                Select Year
              </label>
              <input
                type="number"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                min="2000" max="2100"
                className="w-full bg-[#0a0f1d] border border-white/10 hover:border-gold/30 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
          )}

          {periodType === 'fy' && (
            <div className="flex flex-col col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-gold" />
                Select Financial Year
              </label>
              <select
                value={selectedFYId}
                onChange={e => setSelectedFYId(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-white/10 hover:border-gold/30 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors cursor-pointer"
              >
                {financialYears.filter(fy => fy._id !== 'all').map(fy => (
                  <option key={fy._id} value={fy._id}>
                    {fy.label} {fy.isArchived ? '(Archived)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'custom' && (
            <>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-gold" />
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/10 hover:border-gold/30 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-gold" />
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/10 hover:border-gold/30 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Premise */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] border border-white/5 rounded-2xl no-print">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold" />
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest">Building Document...</p>
        </div>
      ) : !report ? (
        <div className="p-16 text-center text-gray-500 bg-white/[0.01] border border-white/5 rounded-2xl italic text-sm no-print">
          Please complete your date range filter selection above to compile reports.
        </div>
      ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl no-print">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-gold animate-spin" style={{ animationDuration: '4s' }} />
              <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Report Compiled successfully</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handlePrint}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-white/10 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer hover:border-white/20"
              >
                <Printer className="w-4 h-4 text-gold" />
                <span>Print Report</span>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-white/10 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer hover:border-emerald-500/20"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-bold rounded-xl text-xs transition-all cursor-pointer hover:shadow-lg shadow-gold/10"
              >
                <FileText className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* totalPages definition helper */}
          {(() => {
            const totalPages = 3;
            return (
              <div className="flex flex-col items-center gap-8 w-full">
            
            {/* PAGE 1: Management Summary Report */}
            <div className="print-container w-full max-w-[800px] bg-gradient-to-b from-[#0a1128] to-[#040814] border border-white/10 shadow-2xl p-8 sm:p-12 rounded-2xl text-white space-y-6 flex flex-col justify-between">
              <div>
                {/* Header Section */}
                <div className="border-b border-white/10 pb-4 mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-wider text-gold uppercase">{report.title}</h2>
                    <h3 className="text-sm font-bold text-gray-300 mt-1 uppercase">{report.subtitle}</h3>
                    <div className="text-[10px] text-gray-500 font-bold tracking-wider mt-2.5 flex items-center gap-1.5 flex-wrap">
                      <span>COLLECTION FILTER: {report.collectionFilter.toUpperCase()}</span>
                      <span>•</span>
                      <span>REPORT PERIOD: {report.subtitle.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right hidden sm:block">
                    <Sparkles className="w-6 h-6 text-gold ml-auto animate-pulse" />
                    <span className="text-[8px] uppercase tracking-widest text-gold font-bold block mt-1">Management Summary</span>
                  </div>
                </div>

                {/* Grid layout for Sections 1 to 4 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Sponsors */}
                  <div className="space-y-6">
                    {/* Section 1: New Sponsors Added */}
                    <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-3"> New Sponsors Added</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-gray-400">Premium :</div>
                        <div className="font-semibold text-right text-white">{report.sponsorsSummary.premium}</div>
                        <div className="text-gray-400">Smart :</div>
                        <div className="font-semibold text-right text-white">{report.sponsorsSummary.smart}</div>
                        <div className="text-gray-400">Standard :</div>
                        <div className="font-semibold text-right text-white">{report.sponsorsSummary.standard}</div>
                        <div className="border-t border-white/10 pt-2 text-gray-300 font-bold">Total New Sponsors:</div>
                        <div className="border-t border-white/10 pt-2 font-bold text-right text-gold">{report.sponsorsSummary.total}</div>
                      </div>
                    </div>

                    {/* Section 2: Sponsors Added by PRO / Office */}
                    <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] max-h-[220px] overflow-y-auto">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-2.5"> Sponsors Added by PRO / Office</h4>
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-gray-500 text-[10px]">
                            <th className="pb-1.5 font-bold">PRO / Office</th>
                            <th className="pb-1.5 text-right font-bold">Sponsors Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.sponsorsByRecruiter.slice(0, 10).map((s, idx) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="py-1.5 text-gray-300">{s.name}</td>
                              <td className="py-1.5 text-right font-semibold text-white">{s.count}</td>
                            </tr>
                          ))}
                          {report.sponsorsByRecruiter.length === 0 && (
                            <tr>
                              <td colSpan="2" className="py-3 text-center text-gray-500 italic text-[11px]">No recruiters recorded</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Collections */}
                  <div className="space-y-6">
                    {/* Section 3: Collection Summary */}
                    <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-3">3. Collection Summary</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-gray-400">Global Collection:</div>
                        <div className="font-semibold text-right text-white">₹{report.collectionSummary.global.toLocaleString('en-IN')}</div>
                        <div className="text-gray-400">PRO Collection:</div>
                        <div className="font-semibold text-right text-white">₹{report.collectionSummary.pro.toLocaleString('en-IN')}</div>
                        <div className="text-gray-400">Office Collection:</div>
                        <div className="font-semibold text-right text-white">₹{report.collectionSummary.office.toLocaleString('en-IN')}</div>
                        <div className="border-t border-white/10 pt-2 text-gray-300 font-bold">Total Collection:</div>
                        <div className="border-t border-white/10 pt-2 font-bold text-right text-gold">₹{report.collectionSummary.total.toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    {/* Section 4: Allocated Project Distributions */}
                    <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] max-h-[220px] overflow-y-auto">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-2.5">4. Allocated Project Distributions</h4>
                      {(() => {
                        const remaining = report.collectionDistribution?.remainingTakafulBalance || 0;
                        const distList = [
                          { head: 'Takaful', amount: remaining },
                          ...(report.collectionDistribution?.distributions || [])
                        ].filter(item => item.amount > 0);

                        if (distList.length === 0) {
                          return (
                            <div className="py-4 text-center text-gray-500 italic text-[11px]">
                              No distribution records available for the selected period.
                            </div>
                          );
                        }

                        return (
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 text-gray-500 text-[10px]">
                                <th className="pb-1.5 font-bold">Distribution Head</th>
                                <th className="pb-1.5 text-right font-bold">Allocated Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {distList.map((item, idx) => (
                                <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                                  <td className="py-1.5 text-gray-300 font-medium">{item.head}</td>
                                  <td className="py-1.5 text-right text-white font-bold">₹{item.amount.toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Section 5: Detailed Direct Collections Received Through PROs */}
                {report.additionalPivotRows && report.additionalPivotRows.length > 0 && (
                  <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] mt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-3">
                      5. Detailed Direct Collections Received Through PROs
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-gray-500 font-semibold uppercase tracking-wider">
                            <th className="pb-1.5 font-bold">PRO Name</th>
                            {report.additionalColumns.map(col => (
                              <th key={col} className="pb-1.5 text-right font-bold">{col}</th>
                            ))}
                            <th className="pb-1.5 text-right font-bold">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {report.additionalPivotRows.slice(0, 6).map((r, idx) => {
                            const rowTotal = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
                            return (
                              <tr key={idx} className="text-gray-300 hover:bg-white/[0.01]">
                                <td className="py-1.5 font-semibold text-white">{r.proName}</td>
                                {report.additionalColumns.map(col => (
                                  <td key={col} className="py-1.5 text-right text-gray-400">
                                    ₹{(r[col] || 0).toLocaleString('en-IN')}
                                  </td>
                                ))}
                                <td className="py-1.5 text-right font-bold text-gold">
                                  ₹{rowTotal.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section 6: Grand Total Highlight Box */}
                <div className="print-grand-total border-2 border-gold/30 bg-gradient-to-r from-gold/10 to-gold/5 rounded-xl p-5 text-center mt-6 shadow-md shadow-gold/5">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    6. Grand Total
                  </div>
                  {report.additionalSubtotal > 0 && (
                    <div className="text-[11px] text-gray-300 mb-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                      <span>Total Collection: <strong className="text-white">₹{report.collectionSummary.total.toLocaleString('en-IN')}</strong></span>
                      <span className="text-gold">•</span>
                      <span>Direct Collections Through PROs: <strong className="text-white">₹{report.additionalSubtotal.toLocaleString('en-IN')}</strong></span>
                    </div>
                  )}
                  <div className="text-xl sm:text-2xl font-black text-gold tracking-wide">
                    GRAND TOTAL = ₹{report.grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Verified Signatures */}
              <div className="border-t border-white/5 pt-5 mt-6 flex justify-between items-end gap-4">
                <div className="text-left">
                  <span className="text-[8px] text-gray-500 font-semibold uppercase block">Verified by</span>
                  <span className="text-xs font-bold text-white block mt-1.5">_________________________</span>
                  <span className="text-[8px] text-gray-400 block mt-0.5">Finance Administrator</span>
                </div>
                <div className="text-right text-[8px] text-gray-500 font-medium">
                  <span>Takaful Report Engine v2.0</span>
                  <span className="block mt-0.5">Page 1 of {totalPages}</span>
                </div>
              </div>
            </div>

            {/* PAGE 2: Collection Distribution Report */}
            <div className="print-container w-full max-w-[800px] bg-gradient-to-b from-[#0a1128] to-[#040814] border border-white/10 shadow-2xl p-8 sm:p-12 rounded-2xl text-white space-y-6 flex flex-col justify-between page-break">
              <div>
                {/* Header Section */}
                <div className="border-b border-white/10 pb-4 mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-wider text-gold uppercase">TAKAFUL DISTRIBUTION</h2>
                    <h3 className="text-sm font-bold text-gray-300 mt-1 uppercase">{report.subtitle}</h3>
                    <div className="text-[10px] text-gray-500 font-bold tracking-wider mt-2.5 flex items-center gap-1.5 flex-wrap">
                      <span>COLLECTION FILTER: {report.collectionFilter.toUpperCase()}</span>
                      <span>•</span>
                      <span>REPORT PERIOD: {report.subtitle.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right hidden sm:block">
                    <Share2 className="w-6 h-6 text-gold ml-auto animate-pulse" />
                    <span className="text-[8px] uppercase tracking-widest text-gold font-bold block mt-1">Distribution</span>
                  </div>
                </div>

                {/* Distribution Summary Table */}
                <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-3">Allocated Project Distributions</h4>
                  {(() => {
                    const remaining = report.collectionDistribution?.remainingTakafulBalance || 0;
                    const distList = [
                      { head: 'Takaful', amount: remaining },
                      ...(report.collectionDistribution?.distributions || [])
                    ].filter(item => item.amount > 0);

                    if (distList.length === 0) {
                      return (
                        <div className="py-6 text-center text-gray-500 italic text-[11px]">
                          No distribution records available for the selected period.
                        </div>
                      );
                    }

                    return (
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-gray-500 text-[10px]">
                            <th className="pb-1.5 font-bold">Distribution Head</th>
                            <th className="pb-1.5 text-right font-bold">Allocated Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {distList.map((item, idx) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="py-2 text-gray-300 font-medium">{item.head}</td>
                              <td className="py-2 text-right font-bold text-white">₹{item.amount.toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>

              {/* Page Footer */}
              <div className="border-t border-white/5 pt-5 mt-6 flex justify-between items-end gap-4">
                <div className="text-left">
                  <span className="text-[8px] text-gray-500 font-semibold uppercase block">Verified by</span>
                  <span className="text-xs font-bold text-white block mt-1.5">_________________________</span>
                  <span className="text-[8px] text-gray-400 block mt-0.5">Finance Administrator</span>
                </div>
                <div className="text-right text-[8px] text-gray-500 font-medium">
                  <span>Takaful Report Engine v2.0</span>
                  <span className="block mt-0.5">Page 2 of {totalPages}</span>
                </div>
              </div>
            </div>

            {/* PAGE 3: Detailed Collection Report */}
            <div className="print-container w-full max-w-[800px] bg-gradient-to-b from-[#0a1128] to-[#040814] border border-white/10 shadow-2xl p-8 sm:p-12 rounded-2xl text-white space-y-6 flex flex-col justify-between page-break">
              <div>
                <div className="border-b border-white/10 pb-4 mb-6">
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-wider text-gold uppercase">
                    {report.detailedReport.title}
                  </h2>
                  <div className="text-[10px] text-gray-500 font-bold tracking-wider mt-2.5 flex items-center gap-1.5 flex-wrap">
                    <span>REPORT PERIOD: {report.subtitle.toUpperCase()}</span>
                    <span>•</span>
                    <span>GENERATED ON: {new Date(report.generatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="overflow-x-auto mt-6">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-500 font-semibold uppercase tracking-wider bg-white/[0.01]">
                        <th className="px-3 py-2 font-bold text-[10px]">Rank</th>
                        <th className="px-3 py-2 font-bold text-[10px]">{report.collectionFilterCode === 'all' ? 'Category' : 'PRO Name'}</th>
                        <th className="px-3 py-2 text-right font-bold text-[10px]">Collection Amount</th>
                        <th className="px-3 py-2 text-right font-bold text-[10px]">Contribution %</th>
                        {report.collectionFilterCode !== 'all' && <th className="px-3 py-2 text-right font-bold text-[10px]">Status</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {report.detailedReport.rows.map(r => (
                        <tr key={r.rank} className="text-gray-300 hover:bg-white/[0.01]">
                          <td className="px-3 py-2.5 font-bold text-gold">#{r.rank}</td>
                          <td className="px-3 py-2.5 font-semibold text-white">{r.name}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-white">₹{r.amount.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2.5 text-right text-gray-300">{r.pct}%</td>
                          {report.collectionFilterCode !== 'all' && (
                            <td className="px-3 py-2.5 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                r.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Page 3 Footer */}
              <div className="border-t border-white/5 pt-6 mt-6 flex justify-between items-end gap-4">
                <div className="text-left text-xs text-gray-400">
                  <div>Total Contributors: <strong className="text-white">{report.detailedReport.totalContributors}</strong></div>
                  <div className="mt-1">Total Collection: <strong className="text-gold">₹{report.detailedReport.totalCollection.toLocaleString('en-IN')}</strong></div>
                </div>
                <div className="text-right text-[9px] text-gray-500 font-medium">
                  <span>Takaful Report Engine v2.0</span>
                  <span className="block mt-0.5">Page 3 of {totalPages}</span>
                </div>
              </div>
            </div>

          </div>
        )
      })()}
        </div>
      )}
    </div>
  );
};

export default Reports;
