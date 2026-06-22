import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import { 
  FileText, Download, Award, Calendar, FileSpreadsheet, 
  Sparkles, CheckCircle, Sliders, CalendarDays, AlertTriangle,
  Printer, TrendingUp, DollarSign, Users, RefreshCw, Share2
} from 'lucide-react';
import XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ROBOTO_FONT_BASE64 } from '../assets/font';

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

      // Excel Styles Definition (xlsx-js-style format)
      const styles = {
        title: {
          font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        subtitle: {
          font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '555555' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        sectionHeader: {
          font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        tableHeader: {
          fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0D1B2A' } },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'medium', color: { rgb: '0D1B2A' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        tableHeaderLeft: {
          fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0D1B2A' } },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'medium', color: { rgb: '0D1B2A' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        cellNormal: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '333333' } },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        cellNormalRight: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '333333' } },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          },
          alignment: { horizontal: 'right', vertical: 'center' }
        },
        cellNormalCenter: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '333333' } },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        cellShadedNormal: {
          fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
          font: { name: 'Calibri', sz: 10, color: { rgb: '333333' } },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        cellShadedRight: {
          fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
          font: { name: 'Calibri', sz: 10, color: { rgb: '333333' } },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          },
          alignment: { horizontal: 'right', vertical: 'center' }
        },
        cellShadedCenter: {
          fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
          font: { name: 'Calibri', sz: 10, color: { rgb: '333333' } },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        cellBoldNormal: {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0D1B2A' } },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        cellBoldRight: {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0D1B2A' } },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'double', color: { rgb: '0D1B2A' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          },
          alignment: { horizontal: 'right', vertical: 'center' }
        },
        grandTotal: {
          fill: { patternType: 'solid', fgColor: { rgb: '0D1B2A' } },
          font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'F5C518' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: 'F5C518' } },
            bottom: { style: 'medium', color: { rgb: 'F5C518' } },
            left: { style: 'medium', color: { rgb: 'F5C518' } },
            right: { style: 'medium', color: { rgb: 'F5C518' } }
          }
        }
      };

      const makeCell = (val, type = 's', style = null, numFmt = null) => {
        const cell = { v: val, t: type };
        if (style) cell.s = style;
        if (numFmt) cell.z = numFmt;
        return cell;
      };

      // =========================================================================
      // WORKSHEET 1: TAKAFUL REPORT
      // =========================================================================
      const sheet1Rows = [];
      const sheet1Merges = [];

      // Helper to add section headers
      const addSectionHeader = (title) => {
        const rIdx = sheet1Rows.length;
        sheet1Rows.push([makeCell(title, 's', styles.sectionHeader), {}, {}, {}, {}]);
        sheet1Merges.push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: 4 } });
      };

      // Title & Subtitle Block
      sheet1Rows.push([makeCell(report.title, 's', styles.title), {}, {}, {}, {}]);
      sheet1Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });

      sheet1Rows.push([makeCell(report.subtitle, 's', styles.subtitle), {}, {}, {}, {}]);
      sheet1Merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } });

      sheet1Rows.push([{}, {}, {}, {}, {}]); // Spacer

      // Section 1: NEW SPONSORS ADDED
      addSectionHeader('NEW SPONSORS ADDED');
      sheet1Rows.push([
        makeCell('Sponsor Tier', 's', styles.tableHeaderLeft),
        makeCell('Count', 's', styles.tableHeader),
        {}, {}, {}
      ]);
      sheet1Rows.push([
        makeCell('Premium', 's', styles.cellNormal),
        makeCell(report.sponsorsSummary.premium, 'n', styles.cellNormalRight),
        {}, {}, {}
      ]);
      sheet1Rows.push([
        makeCell('Smart', 's', styles.cellShadedNormal),
        makeCell(report.sponsorsSummary.smart, 'n', styles.cellShadedRight),
        {}, {}, {}
      ]);
      sheet1Rows.push([
        makeCell('Standard', 's', styles.cellNormal),
        makeCell(report.sponsorsSummary.standard, 'n', styles.cellNormalRight),
        {}, {}, {}
      ]);
      sheet1Rows.push([
        makeCell('Total New Sponsors', 's', styles.cellBoldNormal),
        makeCell(report.sponsorsSummary.total, 'n', styles.cellBoldRight),
        {}, {}, {}
      ]);
      sheet1Rows.push([{}, {}, {}, {}, {}]); // Spacer

      // Section 2: SPONSORS ADDED BY RECRUITER
      addSectionHeader('SPONSORS ADDED BY RECRUITER');
      sheet1Rows.push([
        makeCell('PRO / Office Recruiter', 's', styles.tableHeaderLeft),
        makeCell('Sponsors Count', 's', styles.tableHeader),
        {}, {}, {}
      ]);
      if (report.sponsorsByRecruiter && report.sponsorsByRecruiter.length > 0) {
        report.sponsorsByRecruiter.forEach((s, idx) => {
          const styleN = idx % 2 === 0 ? styles.cellNormal : styles.cellShadedNormal;
          const styleR = idx % 2 === 0 ? styles.cellNormalRight : styles.cellShadedRight;
          sheet1Rows.push([
            makeCell(s.name, 's', styleN),
            makeCell(s.count, 'n', styleR),
            {}, {}, {}
          ]);
        });
      } else {
        sheet1Rows.push([
          makeCell('No sponsors added', 's', styles.cellNormal),
          makeCell(0, 'n', styles.cellNormalRight),
          {}, {}, {}
        ]);
      }
      sheet1Rows.push([{}, {}, {}, {}, {}]); // Spacer

      // Section 3: COLLECTION SUMMARY
      addSectionHeader('COLLECTION SUMMARY');
      sheet1Rows.push([
        makeCell('Collection Source', 's', styles.tableHeaderLeft),
        makeCell('Amount', 's', styles.tableHeader),
        {}, {}, {}
      ]);
      sheet1Rows.push([
        makeCell('Global Collection', 's', styles.cellNormal),
        makeCell(report.collectionSummary.global, 'n', styles.cellNormalRight, '"₹"#,##,##0'),
        {}, {}, {}
      ]);
      sheet1Rows.push([
        makeCell('PRO Collection', 's', styles.cellShadedNormal),
        makeCell(report.collectionSummary.pro, 'n', styles.cellShadedRight, '"₹"#,##,##0'),
        {}, {}, {}
      ]);
      sheet1Rows.push([
        makeCell('Office Collection', 's', styles.cellNormal),
        makeCell(report.collectionSummary.office, 'n', styles.cellNormalRight, '"₹"#,##,##0'),
        {}, {}, {}
      ]);
      sheet1Rows.push([
        makeCell('Total Collection', 's', styles.cellBoldNormal),
        makeCell(report.collectionSummary.total, 'n', styles.cellBoldRight, '"₹"#,##,##0'),
        {}, {}, {}
      ]);
      sheet1Rows.push([{}, {}, {}, {}, {}]); // Spacer

      // Section 4: ALLOCATED PROJECT DISTRIBUTIONS
      addSectionHeader('ALLOCATED PROJECT DISTRIBUTIONS');
      sheet1Rows.push([
        makeCell('Head', 's', styles.tableHeaderLeft),
        makeCell('Amount', 's', styles.tableHeader),
        {}, {}, {}
      ]);
      const remainingTakaful = report.collectionDistribution?.remainingTakafulBalance || 0;
      sheet1Rows.push([
        makeCell('Takaful', 's', styles.cellNormal),
        makeCell(remainingTakaful, 'n', styles.cellNormalRight, '"₹"#,##,##0'),
        {}, {}, {}
      ]);
      const activeDists = (report.collectionDistribution?.distributions || []).filter(d => d.amount > 0);
      activeDists.forEach((d, idx) => {
        const styleN = idx % 2 === 1 ? styles.cellNormal : styles.cellShadedNormal;
        const styleR = idx % 2 === 1 ? styles.cellNormalRight : styles.cellShadedRight;
        sheet1Rows.push([
          makeCell(d.head, 's', styleN),
          makeCell(d.amount, 'n', styleR, '"₹"#,##,##0'),
          {}, {}, {}
        ]);
      });
      sheet1Rows.push([{}, {}, {}, {}, {}]); // Spacer

      // Section 5: DIRECT COLLECTIONS RECEIVED THROUGH PROs
      addSectionHeader('DIRECT COLLECTIONS RECEIVED THROUGH PROs');
      sheet1Rows.push([
        makeCell('Name', 's', styles.tableHeaderLeft),
        makeCell('Amount', 's', styles.tableHeader),
        {}, {}, {}
      ]);
      const validPivotRows = (report.additionalPivotRows || []).filter(r => {
        const total = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
        return total > 0;
      });
      if (validPivotRows.length > 0) {
        validPivotRows.forEach((r, idx) => {
          const total = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
          const styleN = idx % 2 === 0 ? styles.cellNormal : styles.cellShadedNormal;
          const styleR = idx % 2 === 0 ? styles.cellNormalRight : styles.cellShadedRight;
          sheet1Rows.push([
            makeCell(r.proName, 's', styleN),
            makeCell(total, 'n', styleR, '"₹"#,##,##0'),
            {}, {}, {}
          ]);
        });
      } else {
        sheet1Rows.push([
          makeCell('No direct collections', 's', styles.cellNormal),
          makeCell(0, 'n', styles.cellNormalRight, '"₹"#,##,##0'),
          {}, {}, {}
        ]);
      }
      sheet1Rows.push([
        makeCell('Subtotal', 's', styles.cellBoldNormal),
        makeCell(report.additionalSubtotal, 'n', styles.cellBoldRight, '"₹"#,##,##0'),
        {}, {}, {}
      ]);
      sheet1Rows.push([{}, {}, {}, {}, {}]); // Spacer

      // Section 6: CATEGORY RANKINGS / RANKINGS
      const rankTitle = report.collectionFilterCode === 'all' ? 'CATEGORY RANKINGS' : 'RANKINGS';
      addSectionHeader(rankTitle);
      
      const isAllFilter = report.collectionFilterCode === 'all';
      if (isAllFilter) {
        sheet1Rows.push([
          makeCell('Rank', 's', styles.tableHeader),
          makeCell('Category', 's', styles.tableHeaderLeft),
          makeCell('Collection Amount', 's', styles.tableHeader),
          makeCell('Contribution %', 's', styles.tableHeader),
          {}
        ]);
      } else {
        sheet1Rows.push([
          makeCell('Rank', 's', styles.tableHeader),
          makeCell('PRO Name', 's', styles.tableHeaderLeft),
          makeCell('Collection Amount', 's', styles.tableHeader),
          makeCell('Contribution %', 's', styles.tableHeader),
          makeCell('Status', 's', styles.tableHeader)
        ]);
      }

      if (report.detailedReport && report.detailedReport.rows) {
        const sortedReportRows = [...report.detailedReport.rows].sort((a, b) => b.amount - a.amount);
        sortedReportRows.forEach((r, idx) => {
          const styleN = idx % 2 === 0 ? styles.cellNormal : styles.cellShadedNormal;
          const styleR = idx % 2 === 0 ? styles.cellNormalRight : styles.cellShadedRight;
          const styleC = idx % 2 === 0 ? styles.cellNormalCenter : styles.cellShadedCenter;
          if (isAllFilter) {
            sheet1Rows.push([
              makeCell(r.rank, 'n', styleC),
              makeCell(r.name, 's', styleN),
              makeCell(r.amount, 'n', styleR, '"₹"#,##,##0'),
              makeCell(`${r.pct}%`, 's', styleR),
              {}
            ]);
          } else {
            sheet1Rows.push([
              makeCell(r.rank, 'n', styleC),
              makeCell(r.name, 's', styleN),
              makeCell(r.amount, 'n', styleR, '"₹"#,##,##0'),
              makeCell(`${r.pct}%`, 's', styleR),
              makeCell((r.status || '').toUpperCase(), 's', styleC)
            ]);
          }
        });
      }
      sheet1Rows.push([{}, {}, {}, {}, {}]); // Spacer

      // Grand Total Footer Row
      const grandTotalRowIdx = sheet1Rows.length;
      sheet1Rows.push([
        makeCell(`GRAND TOTAL : ₹ ${report.grandTotal.toLocaleString('en-IN')}`, 's', styles.grandTotal),
        {}, {}, {}, {}
      ]);
      sheet1Merges.push({ s: { r: grandTotalRowIdx, c: 0 }, e: { r: grandTotalRowIdx, c: 4 } });

      const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
      sheet1['!merges'] = sheet1Merges;

      // Auto-fit column widths
      const autoFitCols = (ws, rows) => {
        const colWidths = [];
        rows.forEach(row => {
          row.forEach((cell, cIdx) => {
            let val = "";
            if (cell && cell.v !== undefined && cell.v !== null) {
              val = String(cell.v);
              if (cell.z) {
                val = "₹" + val + ".00";
              }
            }
            const len = val.length;
            if (!colWidths[cIdx] || len > colWidths[cIdx]) {
              colWidths[cIdx] = len;
            }
          });
        });
        ws['!cols'] = colWidths.map(w => ({ wch: Math.max(w + 3, 10) }));
      };
      autoFitCols(sheet1, sheet1Rows);

      // A4 portrait and print settings
      sheet1['!pageSetup'] = { orientation: 'portrait', paperSize: 9 };
      sheet1['!views'] = [{ showGridLines: true }];

      XLSX.utils.book_append_sheet(workbook, sheet1, 'TAKAFUL REPORT');

      // =========================================================================
      // WORKSHEET 2: CONTRIBUTOR DETAILS
      // =========================================================================
      const sheet2Rows = [];
      const sheet2Merges = [];

      sheet2Rows.push([makeCell('CONTRIBUTOR PERFORMANCE DETAILS', 's', styles.title), {}, {}, {}, {}]);
      sheet2Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });

      sheet2Rows.push([makeCell(report.subtitle, 's', styles.subtitle), {}, {}, {}, {}]);
      sheet2Merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } });

      sheet2Rows.push([{}, {}, {}, {}, {}]); // Spacer

      sheet2Rows.push([
        makeCell('Rank', 's', styles.tableHeader),
        makeCell('Name', 's', styles.tableHeaderLeft),
        makeCell('Collection (Takaful)', 's', styles.tableHeader),
        makeCell('Additional Collection', 's', styles.tableHeader),
        makeCell('Total Performance', 's', styles.tableHeader)
      ]);

      const contributors = report.allContributors || report.detailedReport?.rows || [];
      if (contributors.length > 0) {
        contributors.forEach((c, idx) => {
          const styleN = idx % 2 === 0 ? styles.cellNormal : styles.cellShadedNormal;
          const styleR = idx % 2 === 0 ? styles.cellNormalRight : styles.cellShadedRight;
          const styleC = idx % 2 === 0 ? styles.cellNormalCenter : styles.cellShadedCenter;
          sheet2Rows.push([
            makeCell(c.rank, 'n', styleC),
            makeCell(c.name, 's', styleN),
            makeCell(c.takafulAmount || 0, 'n', styleR, '"₹"#,##,##0'),
            makeCell(c.additionalAmount || 0, 'n', styleR, '"₹"#,##,##0'),
            makeCell(c.amount || 0, 'n', styleR, '"₹"#,##,##0')
          ]);
        });
      } else {
        sheet2Rows.push([
          makeCell('-', 's', styles.cellNormalCenter),
          makeCell('No contributor data available', 's', styles.cellNormal),
          makeCell(0, 'n', styles.cellNormalRight, '"₹"#,##,##0'),
          makeCell(0, 'n', styles.cellNormalRight, '"₹"#,##,##0'),
          makeCell(0, 'n', styles.cellNormalRight, '"₹"#,##,##0')
        ]);
      }

      // Total row at the end of Worksheet 2
      const sheet2TotalRowIdx = sheet2Rows.length;
      sheet2Rows.push([
        makeCell('Total', 's', styles.cellBoldNormal),
        makeCell('', 's', styles.cellBoldNormal),
        makeCell(report.collectionSummary.total, 'n', styles.cellBoldRight, '"₹"#,##,##0'),
        makeCell(report.additionalSubtotal, 'n', styles.cellBoldRight, '"₹"#,##,##0'),
        makeCell(report.grandTotal, 'n', styles.cellBoldRight, '"₹"#,##,##0')
      ]);
      sheet2Merges.push({ s: { r: sheet2TotalRowIdx, c: 0 }, e: { r: sheet2TotalRowIdx, c: 1 } });

      const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
      sheet2['!merges'] = sheet2Merges;
      autoFitCols(sheet2, sheet2Rows);

      sheet2['!pageSetup'] = { orientation: 'portrait', paperSize: 9 };
      sheet2['!views'] = [{ showGridLines: true }];

      XLSX.utils.book_append_sheet(workbook, sheet2, 'CONTRIBUTOR DETAILS');

      // Set print repeating header rows
      if (!workbook.Workbook) workbook.Workbook = {};
      workbook.Workbook.Names = [
        {
          Name: '_xlnm.Print_Titles',
          Ref: "'TAKAFUL REPORT'!$1:$2",
          Sheet: 0
        },
        {
          Name: '_xlnm.Print_Titles',
          Ref: "'CONTRIBUTOR DETAILS'!$1:$4",
          Sheet: 1
        }
      ];

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
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // Register Roboto font in jsPDF VFS
      doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_FONT_BASE64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto');

      const pageWidth = doc.internal.pageSize.width; // 210
      const pageHeight = doc.internal.pageSize.height; // 297
      const margin = 15;
      let currentY = 48;

      // Layout helper: ensure there is enough vertical space or add a page
      const ensureSpace = (heightNeeded) => {
        if (currentY + heightNeeded > pageHeight - margin) {
          doc.addPage();
          // Running page header on pages 2+
          doc.setDrawColor(13, 27, 42);
          doc.setLineWidth(0.3);
          doc.line(15, 15, 195, 15);
          
          doc.setFont('Roboto', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(report.title, 15, 12);
          doc.text(report.subtitle, 195, 12, { align: 'right' });
          
          currentY = 22; // Start Y on new page
        }
      };

      // Header block on Page 1 (Centered title and subtitle)
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(13, 27, 42); // Dark Blue
      doc.text(report.title, 105, 23, { align: 'center' });

      doc.setFont('Roboto', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(report.subtitle, 105, 30, { align: 'center' });

      // Shared table style rules (Print-first, dark gray borders, light gray headers)
      const tableOptions = {
        theme: 'grid',
        styles: { 
          fontSize: 10, 
          cellPadding: 2.1, // ~6px padding
          valign: 'middle', 
          lineColor: [120, 120, 120], 
          lineWidth: 0.15,
          textColor: [0, 0, 0],
          font: 'Roboto'
        },
        headStyles: { 
          fillColor: [240, 240, 240], 
          textColor: [0, 0, 0], 
          fontSize: 11, 
          fontStyle: 'bold', 
          halign: 'center',
          lineColor: [100, 100, 100], 
          lineWidth: 0.3,
          font: 'Roboto'
        },
        margin: { left: 15, right: 15 },
        tableWidth: 180
      };

      // Helper to render section title text
      const renderSectionHeader = (title) => {
        ensureSpace(28); // Ensure header + minimum space for starting table fits
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(13, 27, 42); // Dark Blue section titles
        doc.text(title, 15, currentY);
        currentY += 5; // Spacing below title
      };

      // =========================================================================
      // TOP SECTION: NEW SPONSORS ADDED & COLLECTION SUMMARY (2-column layout)
      // =========================================================================
      ensureSpace(15 + 4 * 8); // 4 rows * ~8mm + header/title padding
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(13, 27, 42);
      doc.text('NEW SPONSORS ADDED', 15, currentY);
      doc.text('COLLECTION SUMMARY', 110, currentY);
      currentY += 5;

      const pageBeforeSec1 = doc.internal.getCurrentPageInfo().pageNumber;

      const sponsorsRows = [
        ['Premium Tier', String(report.sponsorsSummary.premium)],
        ['Smart Tier', String(report.sponsorsSummary.smart)],
        ['Standard Tier', String(report.sponsorsSummary.standard)],
        ['Total New Sponsors', String(report.sponsorsSummary.total)]
      ];

      const collectionRows = [
        ['Global Collection', '₹' + report.collectionSummary.global.toLocaleString('en-IN')],
        ['PRO Collection', '₹' + report.collectionSummary.pro.toLocaleString('en-IN')],
        ['Office Collection', '₹' + report.collectionSummary.office.toLocaleString('en-IN')],
        ['Total Collection', '₹' + report.collectionSummary.total.toLocaleString('en-IN')]
      ];

      // Left Table: New Sponsors
      doc.autoTable({
        ...tableOptions,
        body: sponsorsRows,
        startY: currentY,
        margin: { left: 15 },
        tableWidth: 85,
        columnStyles: {
          0: { fontStyle: 'normal' },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 25 }
        },
        didParseCell: function(data) {
          if (data.row.index === 3) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 245];
          }
        },
        rowPageBreak: 'avoid'
      });
      const leftY1 = doc.lastAutoTable.finalY;
      const leftPage1 = doc.internal.getCurrentPageInfo().pageNumber;

      // Switch back to start page
      doc.setPage(pageBeforeSec1);

      // Right Table: Collection Summary
      doc.autoTable({
        ...tableOptions,
        body: collectionRows,
        startY: currentY,
        margin: { left: 110 },
        tableWidth: 85,
        columnStyles: {
          0: { fontStyle: 'normal' },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 35 }
        },
        didParseCell: function(data) {
          if (data.row.index === 3) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 245];
          }
        },
        rowPageBreak: 'avoid'
      });
      const rightY1 = doc.lastAutoTable.finalY;
      const rightPage1 = doc.internal.getCurrentPageInfo().pageNumber;

      const maxPage1 = Math.max(leftPage1, rightPage1);
      doc.setPage(maxPage1);
      currentY = (leftPage1 === rightPage1) 
        ? Math.max(leftY1, rightY1) + 12 
        : (leftPage1 > rightPage1 ? leftY1 : rightY1) + 12;

      // =========================================================================
      // SECOND SECTION: RECRUITERS & PROJECT DISTRIBUTIONS (2-column layout)
      // =========================================================================
      const recruitersRows = report.sponsorsByRecruiter && report.sponsorsByRecruiter.length > 0 
        ? report.sponsorsByRecruiter.map(s => [s.name, String(s.count)])
        : [['No sponsors added', '0']];
      
      const distRemaining = report.collectionDistribution?.remainingTakafulBalance || 0;
      const otherDists = (report.collectionDistribution?.distributions || []).filter(item => item.amount > 0);
      const allocRows = [
        ['Takaful', '₹' + distRemaining.toLocaleString('en-IN')],
        ...otherDists.map(item => [item.head, '₹' + item.amount.toLocaleString('en-IN')])
      ];

      // Pad arrays with empty cells to keep side-by-side box heights equal
      const maxRowsSection2 = Math.max(recruitersRows.length, allocRows.length);
      const paddedRecruiters = [...recruitersRows];
      while (paddedRecruiters.length < maxRowsSection2) {
        paddedRecruiters.push(['', '']);
      }
      const paddedAlloc = [...allocRows];
      while (paddedAlloc.length < maxRowsSection2) {
        paddedAlloc.push(['', '']);
      }

      ensureSpace(15 + maxRowsSection2 * 8); // ~8mm per row + header/title padding
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(13, 27, 42);
      doc.text('SPONSORS ADDED BY RECRUITER', 15, currentY);
      doc.text('ALLOCATED PROJECT DISTRIBUTIONS', 110, currentY);
      currentY += 5;

      const pageBeforeSec2 = doc.internal.getCurrentPageInfo().pageNumber;

      // Left Table: Recruiters
      doc.autoTable({
        ...tableOptions,
        head: [['PRO / OFFICE RECRUITER', 'SPONSORS COUNT']],
        body: paddedRecruiters,
        startY: currentY,
        margin: { left: 15 },
        tableWidth: 85,
        columnStyles: {
          0: { fontStyle: 'normal' },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 25 }
        },
        rowPageBreak: 'avoid'
      });
      const leftY2 = doc.lastAutoTable.finalY;
      const leftPage2 = doc.internal.getCurrentPageInfo().pageNumber;

      // Switch back to start page
      doc.setPage(pageBeforeSec2);

      // Right Table: Project Distributions
      doc.autoTable({
        ...tableOptions,
        head: [['HEAD', 'AMOUNT (Rs.)']],
        body: paddedAlloc,
        startY: currentY,
        margin: { left: 110 },
        tableWidth: 85,
        columnStyles: {
          0: { fontStyle: 'normal' },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 35 }
        },
        rowPageBreak: 'avoid'
      });
      const rightY2 = doc.lastAutoTable.finalY;
      const rightPage2 = doc.internal.getCurrentPageInfo().pageNumber;

      const maxPage2 = Math.max(leftPage2, rightPage2);
      doc.setPage(maxPage2);
      currentY = (leftPage2 === rightPage2) 
        ? Math.max(leftY2, rightY2) + 12 
        : (leftPage2 > rightPage2 ? leftY2 : rightY2) + 12;

      // =========================================================================
      // THIRD SECTION: DIRECT COLLECTIONS RECEIVED THROUGH PROs (Full width pivot)
      // =========================================================================
      const displayColName = (col) => {
        if (col.toLowerCase() === 'markaz') return 'MKZ';
        return col.toUpperCase();
      };

      const pivotHeaders = [['PRO NAME', ...report.additionalColumns.map(displayColName), 'TOTAL AMOUNT']];
      const validPivotRows = (report.additionalPivotRows || []).filter(r => {
        const total = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
        return total > 0;
      });

      const pivotRows = validPivotRows.map(r => {
        const rowTotal = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
        return [
          r.proName,
          ...report.additionalColumns.map(col => '₹' + (r[col] || 0).toLocaleString('en-IN')),
          '₹' + rowTotal.toLocaleString('en-IN')
        ];
      });

      const subtotalRowIdx = pivotRows.length;
      pivotRows.push([
        'Subtotal',
        ...report.additionalColumns.map(col => {
          const colSum = validPivotRows.reduce((sum, r) => sum + (r[col] || 0), 0);
          return '₹' + colSum.toLocaleString('en-IN');
        }),
        '₹' + report.additionalSubtotal.toLocaleString('en-IN')
      ]);

      const pivotColumnStyles = {
        0: { fontStyle: 'bold' }
      };
      report.additionalColumns.forEach((col, idx) => {
        pivotColumnStyles[idx + 1] = { halign: 'right' };
      });
      pivotColumnStyles[report.additionalColumns.length + 1] = { halign: 'right', fontStyle: 'bold' };

      renderSectionHeader('DIRECT COLLECTIONS RECEIVED THROUGH PROs');
      doc.autoTable({
        ...tableOptions,
        head: pivotHeaders,
        body: pivotRows.length > 1 ? pivotRows : [['No direct collections', '₹0']],
        startY: currentY,
        columnStyles: pivotColumnStyles,
        didParseCell: function(data) {
          if (pivotRows.length > 1 && data.row.index === subtotalRowIdx) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 245];
          }
        }
      });
      currentY = doc.lastAutoTable.finalY + 10;

      // =========================================================================
      // FOURTH SECTION: CATEGORY RANKINGS / RANKINGS
      // =========================================================================
      const rankTitle = report.collectionFilterCode === 'all' ? 'CATEGORY RANKINGS' : 'RANKINGS';
      renderSectionHeader(rankTitle);
      
      const isAllFilter = report.collectionFilterCode === 'all';
      const detailedHeaders = isAllFilter
        ? [['RANK', 'CATEGORY', 'COLLECTION AMOUNT', 'CONTRIBUTION %']]
        : [['RANK', 'PRO NAME', 'COLLECTION AMOUNT', 'CONTRIBUTION %', 'STATUS']];

      const sortedDetailedRows = [...report.detailedReport.rows].sort((a, b) => b.amount - a.amount);
      const detailedRows = sortedDetailedRows.map(r => {
        if (isAllFilter) {
          return [String(r.rank), r.name, '₹' + r.amount.toLocaleString('en-IN'), `${r.pct}%`];
        } else {
          return [String(r.rank), r.name, '₹' + r.amount.toLocaleString('en-IN'), `${r.pct}%`, (r.status || '').toUpperCase()];
        }
      });

      doc.autoTable({
        ...tableOptions,
        head: detailedHeaders,
        body: detailedRows,
        startY: currentY,
        columnStyles: isAllFilter ? {
          0: { halign: 'center', cellWidth: 20 },
          1: { fontStyle: 'bold' },
          2: { halign: 'right', fontStyle: 'bold', cellWidth: 50 },
          3: { halign: 'right', cellWidth: 35 }
        } : {
          0: { halign: 'center', cellWidth: 20 },
          1: { fontStyle: 'bold' },
          2: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'center', cellWidth: 25 }
        }
      });
      currentY = doc.lastAutoTable.finalY + 10;

      // =========================================================================
      // GRAND TOTAL FOOTER BLOCK
      // =========================================================================
      ensureSpace(14);
      doc.setDrawColor(13, 27, 42); // Dark Blue border
      doc.setLineWidth(0.5);
      doc.setFillColor(255, 255, 255); // White background
      doc.rect(15, currentY, 180, 8, 'FD');
      
      doc.setTextColor(13, 27, 42); // Dark Blue text
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(10);
      doc.text(`GRAND TOTAL : ₹${report.grandTotal.toLocaleString('en-IN')}`, 105, currentY + 5.3, { align: 'center' });

      // =========================================================================
      // POST-PROCESSING: Dynamic Page Numbers in Footer
      // =========================================================================
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Page ${i} of ${pageCount}`, 195, 285, { align: 'right' });
      }

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
            border-color: #444 !important;
          }
          .print-container text, .print-container span, .print-container div, .print-container td {
            color: black !important;
          }
          .print-container th {
            background-color: #f3f4f6 !important;
            color: black !important;
            border-bottom: 2px solid #222 !important;
          }
          .print-container table, .print-container th, .print-container td {
            border: 1px solid #444 !important;
          }
          .print-container .print-grand-total {
            border: 2px solid #f5c518 !important;
            background-color: #0d1b2a !important;
            padding: 6px 20px !important;
          }
          .print-container .print-grand-total * {
            color: white !important;
          }
          .print-container .print-grand-total .text-gold {
            color: #f5c518 !important;
          }
          .report-scroll-container {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
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
                <div className="border-b border-white/10 pb-4 mb-6 text-center">
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-wider text-gold uppercase">{report.title}</h2>
                  <h3 className="text-xs font-bold text-gray-300 mt-1 uppercase">{report.subtitle}</h3>
                </div>

                {/* Grid layout for Sections 1 to 4 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Sponsors */}
                  <div className="space-y-6">
                    {/* Section 1: New Sponsors Added */}
                    <div className="border border-white/10 rounded-xl py-[12px] px-[14px] bg-white/[0.02]">
                      <h4 className="text-[14px] font-bold uppercase text-gold mb-[8px] print:text-[#0a0f1d]">NEW SPONSORS ADDED</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-gray-400">Premium :</div>
                        <div className="font-semibold text-right text-white min-w-[100px] whitespace-nowrap">{report.sponsorsSummary.premium}</div>
                        <div className="text-gray-400">Smart :</div>
                        <div className="font-semibold text-right text-white min-w-[100px] whitespace-nowrap">{report.sponsorsSummary.smart}</div>
                        <div className="text-gray-400">Standard :</div>
                        <div className="font-semibold text-right text-white min-w-[100px] whitespace-nowrap">{report.sponsorsSummary.standard}</div>
                        <div className="border-t border-white/10 pt-2 text-gray-300 font-bold">Total New Sponsors:</div>
                        <div className="border-t border-white/10 pt-2 font-bold text-right text-gold min-w-[100px] whitespace-nowrap">{report.sponsorsSummary.total}</div>
                      </div>
                    </div>

                    {/* Section 2: Sponsors Added by PRO / Office */}
                    <div className="border border-white/10 rounded-xl py-[12px] px-[14px] bg-white/[0.02] max-h-[220px] overflow-y-auto report-scroll-container">
                      <h4 className="text-[14px] font-bold uppercase text-gold mb-[8px] print:text-[#0a0f1d]">SPONSORS ADDED BY RECRUITER</h4>
                      <table className="w-full text-[11px] border-collapse border border-[#444] text-left">
                        <thead className="bg-[#e5e7eb] text-[#0a151e] uppercase text-[11px] font-bold">
                          <tr className="border-b-2 border-[#222]">
                            <th className="p-[7px_8px] border border-[#444] text-center">PRO / Office</th>
                            <th className="p-[7px_8px] border border-[#444] text-center min-w-[100px] whitespace-nowrap">Sponsors Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.sponsorsByRecruiter.slice(0, 10).map((s, idx) => (
                            <tr key={idx} className="border-b border-[#444] hover:bg-white/[0.02] align-middle">
                              <td className="p-[7px_8px] border border-[#444] text-gray-300">{s.name}</td>
                              <td className="p-[7px_8px] border border-[#444] text-right font-semibold text-white min-w-[100px] whitespace-nowrap">{s.count}</td>
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
                    <div className="border border-white/10 rounded-xl py-[12px] px-[14px] bg-white/[0.02]">
                      <h4 className="text-[14px] font-bold uppercase text-gold mb-[8px] print:text-[#0a0f1d]">COLLECTION SUMMARY</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-gray-400">Global Collection:</div>
                        <div className="font-semibold text-right text-white min-w-[100px] whitespace-nowrap">₹{report.collectionSummary.global.toLocaleString('en-IN')}</div>
                        <div className="text-gray-400">PRO Collection:</div>
                        <div className="font-semibold text-right text-white min-w-[100px] whitespace-nowrap">₹{report.collectionSummary.pro.toLocaleString('en-IN')}</div>
                        <div className="text-gray-400">Office Collection:</div>
                        <div className="font-semibold text-right text-white min-w-[100px] whitespace-nowrap">₹{report.collectionSummary.office.toLocaleString('en-IN')}</div>
                        <div className="border-t border-white/10 pt-2 text-gray-300 font-bold">Total Collection:</div>
                        <div className="border-t border-white/10 pt-2 font-bold text-right text-gold min-w-[100px] whitespace-nowrap">₹{report.collectionSummary.total.toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    {/* Section 4: Allocated Project Distributions */}
                    <div className="border border-white/10 rounded-xl py-[12px] px-[14px] bg-white/[0.02] max-h-[220px] overflow-y-auto report-scroll-container">
                      <h4 className="text-[14px] font-bold uppercase text-gold mb-[8px] print:text-[#0a0f1d]">ALLOCATED PROJECT DISTRIBUTIONS</h4>
                      {(() => {
                        const remaining = report.collectionDistribution?.remainingTakafulBalance || 0;
                        const otherDists = (report.collectionDistribution?.distributions || []).filter(item => item.amount > 0);
                        const distList = [
                          { head: 'Takaful', amount: remaining },
                          ...otherDists
                        ];

                        return (
                          <table className="w-full text-[11px] border-collapse border border-[#444] text-left">
                            <thead className="bg-[#e5e7eb] text-[#0a151e] uppercase text-[11px] font-bold">
                              <tr className="border-b-2 border-[#222]">
                                <th className="p-[7px_8px] border border-[#444] text-center">Head</th>
                                <th className="p-[7px_8px] border border-[#444] text-center min-w-[100px] whitespace-nowrap">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {distList.map((item, idx) => (
                                <tr key={idx} className="border-b border-[#444] hover:bg-white/[0.02] align-middle">
                                  <td className="p-[7px_8px] border border-[#444] text-gray-300 font-medium">{item.head}</td>
                                  <td className="p-[7px_8px] border border-[#444] text-right text-white font-bold min-w-[100px] whitespace-nowrap">₹{item.amount.toLocaleString('en-IN')}</td>
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
                  <div className="border border-white/10 rounded-xl py-[12px] px-[14px] bg-white/[0.02] mt-6">
                    <h4 className="text-[14px] font-bold uppercase text-gold mb-[8px] print:text-[#0a0f1d]">
                      DIRECT COLLECTIONS RECEIVED THROUGH PROs
                    </h4>
                    <div className="overflow-x-auto report-scroll-container">
                      <table className="w-full text-[11px] border-collapse border border-[#444] text-left">
                        <thead className="bg-[#e5e7eb] text-[#0a151e] uppercase text-[11px] font-bold">
                          <tr className="border-b-2 border-[#222]">
                            <th className="p-[7px_8px] border border-[#444] text-center">PRO Name</th>
                            {report.additionalColumns.map(col => (
                              <th key={col} className="p-[7px_8px] border border-[#444] text-center min-w-[80px] whitespace-nowrap">{col}</th>
                            ))}
                            <th className="p-[7px_8px] border border-[#444] text-center min-w-[100px] whitespace-nowrap">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.additionalPivotRows.slice(0, 6).map((r, idx) => {
                            const rowTotal = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
                            return (
                              <tr key={idx} className="border-b border-[#444] hover:bg-white/[0.01] align-middle">
                                <td className="p-[7px_8px] border border-[#444] font-semibold text-white">{r.proName}</td>
                                {report.additionalColumns.map(col => (
                                  <td key={col} className="p-[7px_8px] border border-[#444] text-right text-gray-300 min-w-[80px] whitespace-nowrap">
                                    ₹{(r[col] || 0).toLocaleString('en-IN')}
                                  </td>
                                ))}
                                <td className="p-[7px_8px] border border-[#444] text-right font-bold text-gold min-w-[100px] whitespace-nowrap">
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
                <div className="print-grand-total border-2 border-[#f5c518] bg-[#0d1b2a] rounded-lg py-[6px] px-[20px] text-center mt-6 flex items-center justify-center gap-3">
                  <span className="text-[14px] sm:text-[16px] font-bold text-gold uppercase tracking-wider">
                    GRAND TOTAL :
                  </span>
                  <span className="text-[16px] sm:text-[20px] font-bold text-white tracking-wide">
                    ₹{report.grandTotal.toLocaleString('en-IN')}
                  </span>
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
                  <span>Page 1 of {totalPages}</span>
                </div>
              </div>
            </div>

            {/* PAGE 2: Collection Distribution Report */}
            <div className="print-container w-full max-w-[800px] bg-gradient-to-b from-[#0a1128] to-[#040814] border border-white/10 shadow-2xl p-8 sm:p-12 rounded-2xl text-white space-y-6 flex flex-col justify-between page-break">
              <div>
                {/* Header Section */}
                <div className="border-b border-white/10 pb-4 mb-6 text-center">
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-wider text-gold uppercase">TAKAFUL DISTRIBUTION</h2>
                  <h3 className="text-xs font-bold text-gray-300 mt-1 uppercase">{report.subtitle}</h3>
                </div>

                {/* Distribution Summary Table */}
                <div className="border border-white/10 rounded-xl py-[12px] px-[14px] bg-white/[0.02]">
                  <h4 className="text-[14px] font-bold uppercase text-gold mb-[8px] print:text-[#0a0f1d]">ALLOCATED PROJECT DISTRIBUTIONS</h4>
                  {(() => {
                    const remaining = report.collectionDistribution?.remainingTakafulBalance || 0;
                    const otherDists = (report.collectionDistribution?.distributions || []).filter(item => item.amount > 0);
                    const distList = [
                      { head: 'Takaful', amount: remaining },
                      ...otherDists
                    ];

                    return (
                      <table className="w-full text-[11px] border-collapse border border-[#444] text-left">
                        <thead className="bg-[#e5e7eb] text-[#0a151e] uppercase text-[11px] font-bold">
                          <tr className="border-b-2 border-[#222]">
                            <th className="p-[7px_8px] border border-[#444] text-center">Head</th>
                            <th className="p-[7px_8px] border border-[#444] text-center min-w-[100px] whitespace-nowrap">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {distList.map((item, idx) => (
                            <tr key={idx} className="border-b border-[#444] hover:bg-white/[0.02] align-middle">
                              <td className="p-[7px_8px] border border-[#444] text-gray-300 font-medium">{item.head}</td>
                              <td className="p-[7px_8px] border border-[#444] text-right font-bold text-white min-w-[100px] whitespace-nowrap">₹{item.amount.toLocaleString('en-IN')}</td>
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
                  <span>Page 2 of {totalPages}</span>
                </div>
              </div>
            </div>

            {/* PAGE 3: Detailed Collection Report */}
            <div className="print-container w-full max-w-[800px] bg-gradient-to-b from-[#0a1128] to-[#040814] border border-white/10 shadow-2xl p-8 sm:p-12 rounded-2xl text-white space-y-6 flex flex-col justify-between page-break">
              <div>
                <div className="border-b border-white/10 pb-4 mb-6 text-center">
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-wider text-gold uppercase">
                    {report.detailedReport.title}
                  </h2>
                  <h3 className="text-xs font-bold text-gray-300 mt-1 uppercase">{report.subtitle}</h3>
                </div>

                <div className="overflow-x-auto mt-6 report-scroll-container">
                  <table className="w-full text-[11px] border-collapse border border-[#444] text-left">
                    <thead className="bg-[#e5e7eb] text-[#0a151e] uppercase text-[11px] font-bold">
                      <tr className="border-b-2 border-[#222]">
                        <th className="p-[7px_8px] border border-[#444] text-center">{report.collectionFilterCode === 'all' ? 'Category' : 'PRO Name'}</th>
                        <th className="p-[7px_8px] border border-[#444] text-center min-w-[100px] whitespace-nowrap">Collection Amount</th>
                        <th className="p-[7px_8px] border border-[#444] text-center min-w-[100px] whitespace-nowrap">Contribution %</th>
                        {report.collectionFilterCode !== 'all' && <th className="p-[7px_8px] border border-[#444] text-center">Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...report.detailedReport.rows].sort((a, b) => b.amount - a.amount).map(r => (
                        <tr key={r.name} className="border-b border-[#444] hover:bg-white/[0.01] align-middle">
                          <td className="p-[7px_8px] border border-[#444] font-semibold text-white">{r.name}</td>
                          <td className="p-[7px_8px] border border-[#444] text-right font-bold text-white min-w-[100px] whitespace-nowrap">₹{r.amount.toLocaleString('en-IN')}</td>
                          <td className="p-[7px_8px] border border-[#444] text-right text-gray-300 min-w-[100px] whitespace-nowrap">{r.pct}%</td>
                          {report.collectionFilterCode !== 'all' && (
                            <td className="p-[7px_8px] border border-[#444] text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                r.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {r.status.toUpperCase()}
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
                  <span>Page 3 of {totalPages}</span>
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
