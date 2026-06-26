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
        setReport({
          ...res.data.data,
          allContributors: res.data.allContributors || []
        });
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
          fill: { patternType: 'solid', fgColor: { rgb: '0D1B2A' } },
          font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'F5C518' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        subtitle: {
          fill: { patternType: 'solid', fgColor: { rgb: '0D1B2A' } },
          font: { name: 'Calibri', sz: 10, color: { rgb: 'DCDCDC' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        sectionHeader: {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        sideSectionTitle: {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        tableHeader: {
          fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        tableHeaderLeft: {
          fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        cellNormal: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        cellNormalRight: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'right', vertical: 'center' }
        },
        cellNormalCenter: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        cellShadedNormal: {
          fill: { patternType: 'solid', fgColor: { rgb: 'FAFAFA' } },
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        cellShadedRight: {
          fill: { patternType: 'solid', fgColor: { rgb: 'FAFAFA' } },
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'right', vertical: 'center' }
        },
        cellShadedCenter: {
          fill: { patternType: 'solid', fgColor: { rgb: 'FAFAFA' } },
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        cellBoldNormal: {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        },
        cellBoldRight: {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
          border: {
            top: { style: 'thin', color: { rgb: '666666' } },
            bottom: { style: 'thin', color: { rgb: '666666' } },
            left: { style: 'thin', color: { rgb: '666666' } },
            right: { style: 'thin', color: { rgb: '666666' } }
          },
          alignment: { horizontal: 'right', vertical: 'center' }
        },
        financialSummary: {
          fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: '0D1B2A' } },
            bottom: { style: 'medium', color: { rgb: '0D1B2A' } },
            left: { style: 'medium', color: { rgb: '0D1B2A' } },
            right: { style: 'medium', color: { rgb: '0D1B2A' } }
          }
        },
        grandTotal: {
          fill: { patternType: 'solid', fgColor: { rgb: 'FFFDE6' } },
          font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: '0D1B2A' } },
            bottom: { style: 'medium', color: { rgb: '0D1B2A' } },
            left: { style: 'medium', color: { rgb: '0D1B2A' } },
            right: { style: 'medium', color: { rgb: '0D1B2A' } }
          }
        }
      };

      const makeCell = (val, type = 's', style = null, numFmt = null) => {
        const cell = { v: val, t: type };
        if (style) cell.s = style;
        if (numFmt) cell.z = numFmt;
        return cell;
      };

      const maxCols = Math.max(5, (report.additionalColumns ? report.additionalColumns.length + 2 : 5));

      const sheet1Rows = [];
      const sheet1Merges = [];

      // Title & Subtitle Block
      sheet1Rows.push(Array.from({ length: maxCols }, (_, i) => i === 0 ? makeCell(report.title || 'TAKAFUL FINANCIAL YEAR REPORT', 's', styles.title) : {}));
      sheet1Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } });

      sheet1Rows.push(Array.from({ length: maxCols }, (_, i) => i === 0 ? makeCell(report.subtitle || 'FY 2026-27', 's', styles.subtitle) : {}));
      sheet1Merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } });

      sheet1Rows.push(Array.from({ length: maxCols }, () => ({}))); // Spacer

      // =========================================================================
      // ROW 1: NEW SPONSORS ADDED & COLLECTION SUMMARY (side-by-side)
      // =========================================================================
      const sideTitleRow = Array.from({ length: maxCols }, () => ({}));
      sideTitleRow[0] = makeCell('NEW SPONSORS ADDED', 's', styles.sideSectionTitle);
      sideTitleRow[3] = makeCell('COLLECTION SUMMARY', 's', styles.sideSectionTitle);
      sheet1Rows.push(sideTitleRow);
      sheet1Merges.push({ s: { r: sheet1Rows.length - 1, c: 0 }, e: { r: sheet1Rows.length - 1, c: 1 } });
      sheet1Merges.push({ s: { r: sheet1Rows.length - 1, c: 3 }, e: { r: sheet1Rows.length - 1, c: 4 } });

      const sponsorsRows = [
        ['Premium', report.sponsorsSummary.premium, false],
        ['Smart', report.sponsorsSummary.smart, true],
        ['Standard', report.sponsorsSummary.standard, false],
        ['Total New Sponsors', report.sponsorsSummary.total, false, true]
      ];

      const collectionRows = [
        ['Global Collection', report.collectionSummary.global, false],
        ['PRO Collection', report.collectionSummary.pro, true],
        ['Office Collection', report.collectionSummary.office, false],
        ['Total Collection', report.collectionSummary.total, false, true]
      ];

      for (let i = 0; i < 4; i++) {
        const row = Array.from({ length: maxCols }, () => ({}));
        const sRow = sponsorsRows[i];
        const cRow = collectionRows[i];
        
        const sStyleL = sRow[3] ? styles.cellBoldNormal : (sRow[2] ? styles.cellShadedNormal : styles.cellNormal);
        const sStyleR = sRow[3] ? styles.cellBoldRight : (sRow[2] ? styles.cellShadedRight : styles.cellNormalRight);
        row[0] = makeCell(sRow[0], 's', sStyleL);
        row[1] = makeCell(sRow[1], 'n', sStyleR);
        
        const cStyleL = cRow[3] ? styles.cellBoldNormal : (cRow[2] ? styles.cellShadedNormal : styles.cellNormal);
        const cStyleR = cRow[3] ? styles.cellBoldRight : (cRow[2] ? styles.cellShadedRight : styles.cellNormalRight);
        row[3] = makeCell(cRow[0], 's', cStyleL);
        row[4] = makeCell(cRow[1], 'n', cStyleR, '"₹"#,##,##0');
        
        sheet1Rows.push(row);
      }

      sheet1Rows.push(Array.from({ length: maxCols }, () => ({}))); // Spacer

      // =========================================================================
      // ROW 2: RECRUITERS & PROJECT DISTRIBUTIONS (side-by-side)
      // =========================================================================
      const recruitersRows = report.sponsorsByRecruiter && report.sponsorsByRecruiter.length > 0 
        ? report.sponsorsByRecruiter.map(s => [s.name, s.count])
        : [['No sponsors added', 0]];
      
      const distRemaining = report.collectionDistribution?.remainingTakafulBalance || 0;
      const otherDists = (report.collectionDistribution?.distributions || []).filter(item => item.amount > 0);
      const allocRows = [
        ['Takaful', distRemaining],
        ...otherDists.map(item => [item.head, item.amount])
      ];

      const maxRowsSection2 = Math.max(recruitersRows.length, allocRows.length);
      const paddedRecruiters = [...recruitersRows];
      while (paddedRecruiters.length < maxRowsSection2) {
        paddedRecruiters.push(['', '']);
      }
      const paddedAlloc = [...allocRows];
      while (paddedAlloc.length < maxRowsSection2) {
        paddedAlloc.push(['', '']);
      }

      const sideTitleRow2 = Array.from({ length: maxCols }, () => ({}));
      sideTitleRow2[0] = makeCell('SPONSORS ADDED BY RECRUITER', 's', styles.sideSectionTitle);
      sideTitleRow2[3] = makeCell('ALLOCATED PROJECT DISTRIBUTIONS', 's', styles.sideSectionTitle);
      sheet1Rows.push(sideTitleRow2);
      sheet1Merges.push({ s: { r: sheet1Rows.length - 1, c: 0 }, e: { r: sheet1Rows.length - 1, c: 1 } });
      sheet1Merges.push({ s: { r: sheet1Rows.length - 1, c: 3 }, e: { r: sheet1Rows.length - 1, c: 4 } });

      const rowHeaders2 = Array.from({ length: maxCols }, () => ({}));
      rowHeaders2[0] = makeCell('PRO / OFFICE RECRUITER', 's', styles.tableHeaderLeft);
      rowHeaders2[1] = makeCell('SPONSORS COUNT', 's', styles.tableHeader);
      rowHeaders2[3] = makeCell('HEAD', 's', styles.tableHeaderLeft);
      rowHeaders2[4] = makeCell('AMOUNT', 's', styles.tableHeader);
      sheet1Rows.push(rowHeaders2);

      for (let i = 0; i < maxRowsSection2; i++) {
        const row = Array.from({ length: maxCols }, () => ({}));
        const rec = paddedRecruiters[i];
        const alloc = paddedAlloc[i];
        const isShaded = i % 2 === 1;
        
        const styleL = isShaded ? styles.cellShadedNormal : styles.cellNormal;
        const styleR = isShaded ? styles.cellShadedRight : styles.cellNormalRight;
        
        row[0] = makeCell(rec[0], 's', styleL);
        row[1] = rec[1] === '' ? makeCell('', 's', styleR) : makeCell(rec[1], 'n', styleR);
        
        row[3] = makeCell(alloc[0], 's', styleL);
        row[4] = alloc[1] === '' ? makeCell('', 's', styleR) : makeCell(alloc[1], 'n', styleR, '"₹"#,##,##0');
        
        sheet1Rows.push(row);
      }

      sheet1Rows.push(Array.from({ length: maxCols }, () => ({}))); // Spacer

      // =========================================================================
      // ROW 2.5: FINANCIAL SUMMARY (one-line summary)
      // =========================================================================
      const finSummaryRowIdx = sheet1Rows.length;
      const finSummaryText = `TOTAL COLLECTION: ₹ ${(report.collectionSummary.total).toLocaleString('en-IN')}   |   TOTAL EXPENSE: ₹ ${(report.totalExpense || 0).toLocaleString('en-IN')}   |   NET BALANCE: ₹ ${(report.netBalance || 0).toLocaleString('en-IN')}`;
      const finSummaryRow = Array.from({ length: maxCols }, (_, i) => i === 0 ? makeCell(finSummaryText, 's', styles.financialSummary) : {});
      sheet1Rows.push(finSummaryRow);
      sheet1Merges.push({ s: { r: finSummaryRowIdx, c: 0 }, e: { r: finSummaryRowIdx, c: maxCols - 1 } });
      
      sheet1Rows.push(Array.from({ length: maxCols }, () => ({}))); // Spacer

      // =========================================================================
      // ROW 3: DIRECT COLLECTIONS RECEIVED THROUGH PROs (Full width pivot)
      // =========================================================================
      const displayColName = (col) => {
        if (col.toLowerCase() === 'markaz') return 'MKZ';
        return col.toUpperCase();
      };

      const validPivotRows = (report.additionalPivotRows || []).filter(r => {
        const total = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
        return total > 0;
      });

      const pivotTitleRow = Array.from({ length: maxCols }, () => ({}));
      pivotTitleRow[0] = makeCell('DIRECT COLLECTIONS RECEIVED THROUGH PROs', 's', styles.sectionHeader);
      sheet1Rows.push(pivotTitleRow);
      sheet1Merges.push({ s: { r: sheet1Rows.length - 1, c: 0 }, e: { r: sheet1Rows.length - 1, c: maxCols - 1 } });

      const pivotHeaderRow = Array.from({ length: maxCols }, () => ({}));
      pivotHeaderRow[0] = makeCell('PRO NAME', 's', styles.tableHeaderLeft);
      report.additionalColumns.forEach((col, idx) => {
        pivotHeaderRow[idx + 1] = makeCell(displayColName(col), 's', styles.tableHeader);
      });
      pivotHeaderRow[report.additionalColumns.length + 1] = makeCell('TOTAL AMOUNT', 's', styles.tableHeader);
      sheet1Rows.push(pivotHeaderRow);

      if (validPivotRows.length > 0) {
        validPivotRows.forEach((r, idx) => {
          const row = Array.from({ length: maxCols }, () => ({}));
          const isShaded = idx % 2 === 1;
          const styleL = isShaded ? styles.cellShadedNormal : styles.cellNormal;
          const styleR = isShaded ? styles.cellShadedRight : styles.cellNormalRight;
          
          row[0] = makeCell(r.proName, 's', styleL);
          report.additionalColumns.forEach((col, cIdx) => {
            row[cIdx + 1] = makeCell(r[col] || 0, 'n', styleR, '"₹"#,##,##0');
          });
          const rowTotal = report.additionalColumns.reduce((sum, col) => sum + (r[col] || 0), 0);
          row[report.additionalColumns.length + 1] = makeCell(rowTotal, 'n', styleR, '"₹"#,##,##0');
          
          sheet1Rows.push(row);
        });
        
        // Subtotal Row
        const subtotalRow = Array.from({ length: maxCols }, () => ({}));
        subtotalRow[0] = makeCell('Subtotal', 's', styles.cellBoldNormal);
        report.additionalColumns.forEach((col, cIdx) => {
          const colSum = validPivotRows.reduce((sum, r) => sum + (r[col] || 0), 0);
          subtotalRow[cIdx + 1] = makeCell(colSum, 'n', styles.cellBoldRight, '"₹"#,##,##0');
        });
        subtotalRow[report.additionalColumns.length + 1] = makeCell(report.additionalSubtotal, 'n', styles.cellBoldRight, '"₹"#,##,##0');
        
        sheet1Rows.push(subtotalRow);
      } else {
        const row = Array.from({ length: maxCols }, () => ({}));
        row[0] = makeCell('No direct collections', 's', styles.cellNormal);
        row[1] = makeCell(0, 'n', styles.cellNormalRight, '"₹"#,##,##0');
        sheet1Rows.push(row);
      }

      sheet1Rows.push(Array.from({ length: maxCols }, () => ({}))); // Spacer

      // =========================================================================
      // ROW 4: PRO COLLECTION DETAIL (No STATUS column)
      // =========================================================================
      const proDetailTitleRow = Array.from({ length: maxCols }, () => ({}));
      proDetailTitleRow[0] = makeCell('PRO COLLECTION DETAIL', 's', styles.sectionHeader);
      sheet1Rows.push(proDetailTitleRow);
      sheet1Merges.push({ s: { r: sheet1Rows.length - 1, c: 0 }, e: { r: sheet1Rows.length - 1, c: maxCols - 1 } });

      const proDetailHeaderRow = Array.from({ length: maxCols }, () => ({}));
      proDetailHeaderRow[0] = makeCell('PRO NAME', 's', styles.tableHeaderLeft);
      proDetailHeaderRow[1] = makeCell('COLLECTION (TAKAFUL)', 's', styles.tableHeader);
      proDetailHeaderRow[2] = makeCell('ADDITIONAL COLLECTION', 's', styles.tableHeader);
      proDetailHeaderRow[3] = makeCell('TOTAL PERFORMANCE', 's', styles.tableHeader);
      sheet1Rows.push(proDetailHeaderRow);

      const contributors = report.allContributors || [];
      if (contributors.length > 0) {
        contributors.forEach((c, idx) => {
          const row = Array.from({ length: maxCols }, () => ({}));
          const isShaded = idx % 2 === 1;
          const styleL = isShaded ? styles.cellShadedNormal : styles.cellNormal;
          const styleR = isShaded ? styles.cellShadedRight : styles.cellNormalRight;
          
          row[0] = makeCell(c.name, 's', styleL);
          row[1] = makeCell(c.takafulAmount || 0, 'n', styleR, '"₹"#,##,##0');
          row[2] = makeCell(c.additionalAmount || 0, 'n', styleR, '"₹"#,##,##0');
          row[3] = makeCell(c.amount || 0, 'n', styleR, '"₹"#,##,##0');
          
          sheet1Rows.push(row);
        });
      } else {
        const row = Array.from({ length: maxCols }, () => ({}));
        row[0] = makeCell('No contributor detail available', 's', styles.cellNormal);
        row[1] = makeCell(0, 'n', styles.cellNormalRight, '"₹"#,##,##0');
        row[2] = makeCell(0, 'n', styles.cellNormalRight, '"₹"#,##,##0');
        row[3] = makeCell(0, 'n', styles.cellNormalRight, '"₹"#,##,##0');
        sheet1Rows.push(row);
      }

      sheet1Rows.push(Array.from({ length: maxCols }, () => ({}))); // Spacer

      // =========================================================================
      // ROW 5: RANKINGS (No STATUS column)
      // =========================================================================
      const rankTitle = report.collectionFilterCode === 'all' ? 'CATEGORY RANKINGS' : 'RANKINGS';
      const isAllFilter = report.collectionFilterCode === 'all';

      const rankTitleRow = Array.from({ length: maxCols }, () => ({}));
      rankTitleRow[0] = makeCell(rankTitle, 's', styles.sectionHeader);
      sheet1Rows.push(rankTitleRow);
      sheet1Merges.push({ s: { r: sheet1Rows.length - 1, c: 0 }, e: { r: sheet1Rows.length - 1, c: maxCols - 1 } });

      const rankHeaderRow = Array.from({ length: maxCols }, () => ({}));
      rankHeaderRow[0] = makeCell('RANK', 's', styles.tableHeader);
      rankHeaderRow[1] = makeCell(isAllFilter ? 'CATEGORY' : 'PRO NAME', 's', styles.tableHeaderLeft);
      rankHeaderRow[2] = makeCell('COLLECTION AMOUNT', 's', styles.tableHeader);
      rankHeaderRow[3] = makeCell('CONTRIBUTION %', 's', styles.tableHeader);
      sheet1Rows.push(rankHeaderRow);

      const sortedDetailedRows = [...report.detailedReport.rows].sort((a, b) => b.amount - a.amount);
      sortedDetailedRows.forEach((r, idx) => {
        const row = Array.from({ length: maxCols }, () => ({}));
        const isShaded = idx % 2 === 1;
        const styleL = isShaded ? styles.cellShadedNormal : styles.cellNormal;
        const styleR = isShaded ? styles.cellShadedRight : styles.cellNormalRight;
        const styleC = isShaded ? styles.cellShadedCenter : styles.cellNormalCenter;
        
        row[0] = makeCell(r.rank, 'n', styleC);
        row[1] = makeCell(r.name, 's', styleL);
        row[2] = makeCell(r.amount, 'n', styleR, '"₹"#,##,##0');
        row[3] = makeCell(`${r.pct}%`, 's', styleR);
        
        sheet1Rows.push(row);
      });

      sheet1Rows.push(Array.from({ length: maxCols }, () => ({}))); // Spacer

      // =========================================================================
      // ROW 6: GRAND TOTAL FOOTER BLOCK
      // =========================================================================
      const grandTotalRowIdx = sheet1Rows.length;
      const grandTotalRow = Array.from({ length: maxCols }, (_, i) => i === 0 ? makeCell(`GRAND TOTAL : ₹ ${report.grandTotal.toLocaleString('en-IN')}`, 's', styles.grandTotal) : {});
      sheet1Rows.push(grandTotalRow);
      sheet1Merges.push({ s: { r: grandTotalRowIdx, c: 0 }, e: { r: grandTotalRowIdx, c: maxCols - 1 } });

      const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
      sheet1['!merges'] = sheet1Merges;

      // Auto-fit column widths (ignoring title/subtitle/section titles/grand total rows)
      const autoFitCols = (ws, rows) => {
        const colWidths = [];
        rows.forEach((row, rIdx) => {
          if (rIdx === 0 || rIdx === 1 || rIdx === rows.length - 1) return;
          const hasMultipleValues = row.filter(cell => cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '').length > 1;
          if (!hasMultipleValues) return;

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
        ws['!cols'] = colWidths.map((w, idx) => {
          if (idx === 2) return { wch: 4 };
          return { wch: Math.max(w + 3, 12) };
        });
      };
      autoFitCols(sheet1, sheet1Rows);

      sheet1['!pageSetup'] = { orientation: 'portrait', paperSize: 9 };
      sheet1['!views'] = [{ showGridLines: true }];

      XLSX.utils.book_append_sheet(workbook, sheet1, 'TAKAFUL REPORT');

      // Set print repeating header rows
      if (!workbook.Workbook) workbook.Workbook = {};
      workbook.Workbook.Names = [
        {
          Name: '_xlnm.Print_Titles',
          Ref: "'TAKAFUL REPORT'!$1:$2",
          Sheet: 0
        }
      ];

      const fileFilter = selectedModule ? selectedModule.name.replace(/\s+/g, '_') : 'All';
      XLSX.writeFile(workbook, `Takaful_Report_${report.subtitle.replace(/[^a-zA-Z0-9]/g, '_')}_${fileFilter}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate Excel sheet');
    } finally {
      setExportingExcel(false);
    }
  };

  // EXPORT TO PDF
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
      doc.setFont('Roboto', 'normal');

      const pageWidth = doc.internal.pageSize.width; // 210
      const pageHeight = doc.internal.pageSize.height; // 297
      let currentY = 38; // Content starts below Y=32 divider (around 38mm)

      // Spacing checker helper to prevent widow/orphan rows and section splits
      const checkTableSpacing = (rowCount, hasTitle = true) => {
        const tableHeight = 8 + (rowCount * 6.5); // header (8) + rows
        const sectionHeight = tableHeight + (hasTitle ? (8 + 4) : 0);
        
        // If it fits entirely on current page
        if (currentY + sectionHeight <= pageHeight - 25) {
          return;
        }
        
        // If it can't fit on a single page anyway
        if (sectionHeight > (pageHeight - 25 - 38)) {
          const minHeight = (hasTitle ? (8 + 4) : 0) + 8 + (3 * 6.5);
          if (currentY + minHeight > pageHeight - 25) {
            doc.addPage();
            currentY = 38;
          }
        } else {
          // Move the whole section to next page
          doc.addPage();
          currentY = 38;
        }
      };

      // Table outer border drawing helper
      const drawTableOuterBorder = (table, startPage, startY, width = 190) => {
        const endPage = doc.internal.getCurrentPageInfo().pageNumber;
        const endY = table.finalY;
        const left = table.settings.margin.left;
        
        doc.setDrawColor(102, 102, 102); // #666
        doc.setLineWidth(0.6); // 2px equivalent border
        
        for (let p = startPage; p <= endPage; p++) {
          doc.setPage(p);
          let topY = (p === startPage) ? startY : 38;
          let bottomY = (p === endPage) ? endY : (pageHeight - 25);
          doc.rect(left, topY, width, bottomY - topY);
        }
      };

      // Helper to draw outer border for side-by-side tables
      const drawSideBySideOuterBorder = (startX, startY, width, height) => {
        doc.setDrawColor(102, 102, 102); // #666
        doc.setLineWidth(0.6); // 2px equivalent border
        doc.rect(startX, startY, width, height);
      };

      // Helper to render section title text
      const renderSectionHeader = (title, rowCount) => {
        checkTableSpacing(rowCount, true);
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(13, 27, 42); // Dark Blue
        
        if (currentY > 38) {
          currentY += 8; // 8mm margin above title
        }
        
        doc.text(title, 10, currentY);
        currentY += 4; // 4mm below title (table startY)
      };

      // Shared table style rules (Print-first, dark gray borders, light gray headers)
      const tableOptions = {
        theme: 'grid',
        styles: { 
          fontSize: 10, 
          cellPadding: 2.1, // ~6px padding
          valign: 'middle', 
          lineColor: [102, 102, 102], // #666
          lineWidth: 0.25,
          textColor: [0, 0, 0],
          font: 'Roboto'
        },
        headStyles: { 
          fillColor: [243, 244, 246], // #F3F4F6
          textColor: [0, 0, 0], 
          fontStyle: 'bold', 
          halign: 'center',
          lineColor: [102, 102, 102], 
          lineWidth: 0.25,
          font: 'Roboto'
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250] // #FAFAFA
        },
        margin: { left: 10, right: 10, top: 38, bottom: 25 },
        tableWidth: 190,
        didParseCell: function(data) {
          if (data.section === 'body') {
            const text = data.cell.text.join('').trim();
            if (text.startsWith('₹') || data.column.dataKey === 'amount' || data.column.dataKey === 'total') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.halign = 'right';
            }
          }
        }
      };

      // =========================================================================
      // PAGE 1 - ROW 1: NEW SPONSORS ADDED & COLLECTION SUMMARY (2-column layout)
      // =========================================================================
      // Title layout spacing
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(13, 27, 42);
      doc.text('NEW SPONSORS ADDED', 10, currentY);
      doc.text('COLLECTION SUMMARY', 110, currentY);
      currentY += 4;

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
        margin: { left: 10 },
        tableWidth: 90,
        columnStyles: {
          0: { fontStyle: 'normal' },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 25 }
        },
        rowPageBreak: 'avoid'
      });
      const leftY1 = doc.lastAutoTable.finalY;

      // Switch back to start page
      doc.setPage(pageBeforeSec1);

      // Right Table: Collection Summary
      doc.autoTable({
        ...tableOptions,
        body: collectionRows,
        startY: currentY,
        margin: { left: 110 },
        tableWidth: 90,
        columnStyles: {
          0: { fontStyle: 'normal' },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 35 }
        },
        rowPageBreak: 'avoid'
      });
      const rightY1 = doc.lastAutoTable.finalY;

      // Draw borders for Row 1
      const height1 = leftY1 - currentY;
      drawSideBySideOuterBorder(10, currentY, 90, height1);
      drawSideBySideOuterBorder(110, currentY, 90, height1);

      currentY = leftY1;

      // =========================================================================
      // PAGE 1 - ROW 2: RECRUITERS & PROJECT DISTRIBUTIONS (2-column layout)
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

      // Check if Row 2 fits on Page 1.
      // Margin above (8), Title (4), Table margin (4), Header (8), rows (maxRowsSection2 * 6.5)
      const heightNeededRow2 = 24 + maxRowsSection2 * 6.5;
      if (currentY + heightNeededRow2 > pageHeight - 25) {
        doc.addPage();
        currentY = 38;
      } else {
        currentY += 8; // 8mm margin above title
      }

      doc.setFont('Roboto', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(13, 27, 42);
      doc.text('SPONSORS ADDED BY RECRUITER', 10, currentY);
      doc.text('ALLOCATED PROJECT DISTRIBUTIONS', 110, currentY);
      currentY += 4;

      const pageBeforeSec2 = doc.internal.getCurrentPageInfo().pageNumber;

      // Left Table: Recruiters
      doc.autoTable({
        ...tableOptions,
        head: [['PRO / OFFICE RECRUITER', 'SPONSORS COUNT']],
        body: paddedRecruiters,
        startY: currentY,
        margin: { left: 10 },
        tableWidth: 90,
        columnStyles: {
          0: { fontStyle: 'normal' },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 25 }
        },
        rowPageBreak: 'avoid'
      });
      const leftY2 = doc.lastAutoTable.finalY;

      // Switch back to start page
      doc.setPage(pageBeforeSec2);

      // Right Table: Project Distributions
      doc.autoTable({
        ...tableOptions,
        head: [['HEAD', 'AMOUNT']],
        body: paddedAlloc,
        startY: currentY,
        margin: { left: 110 },
        tableWidth: 90,
        columnStyles: {
          0: { fontStyle: 'normal' },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 35 }
        },
        rowPageBreak: 'avoid'
      });
      const rightY2 = doc.lastAutoTable.finalY;

      // Draw borders for Row 2
      const height2 = leftY2 - currentY;
      drawSideBySideOuterBorder(10, currentY, 90, height2);
      drawSideBySideOuterBorder(110, currentY, 90, height2);

      // Force page break to Page 2
      doc.addPage();
      currentY = 38;

      // =========================================================================
      // PAGE 2: FINANCIAL SUMMARY (Expense & Balance)
      // =========================================================================
      renderSectionHeader('FINANCIAL SUMMARY', 1);
      const pageBeforeSummary = doc.internal.getCurrentPageInfo().pageNumber;
      const summaryStartY = currentY;

      const summaryRows = [[
        'Total Collection\n₹' + report.collectionSummary.total.toLocaleString('en-IN'),
        'Total Expense\n₹' + (report.totalExpense || 0).toLocaleString('en-IN'),
        'Net Balance\n₹' + (report.netBalance || 0).toLocaleString('en-IN')
      ]];

      doc.autoTable({
        ...tableOptions,
        body: summaryRows,
        startY: currentY,
        theme: 'grid',
        styles: { 
          fontSize: 10, 
          cellPadding: 3, 
          valign: 'middle', 
          lineColor: [102, 102, 102], // Gray internal borders
          lineWidth: 0.25,
          textColor: [0, 0, 0],
          font: 'Roboto',
          fillColor: [243, 244, 246], // Light gray background
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 63.3 },
          1: { cellWidth: 63.3 },
          2: { cellWidth: 63.3 }
        }
      });
      // Draw dark blue outer border
      const endPageSummary = doc.internal.getCurrentPageInfo().pageNumber;
      const endYSummary = doc.lastAutoTable.finalY;
      const leftSummary = doc.lastAutoTable.settings.margin.left;
      doc.setDrawColor(13, 27, 42); // Dark Blue border
      doc.setLineWidth(0.6); // 2px equivalent border
      for (let p = pageBeforeSummary; p <= endPageSummary; p++) {
        doc.setPage(p);
        let topY = (p === pageBeforeSummary) ? summaryStartY : 38;
        let bottomY = (p === endPageSummary) ? endYSummary : (pageHeight - 25);
        doc.rect(leftSummary, topY, 190, bottomY - topY);
      }
      doc.setPage(endPageSummary);
      currentY = doc.lastAutoTable.finalY + 6; // Spacing below summary is 6mm

      // =========================================================================
      // PAGE 2: DIRECT COLLECTIONS RECEIVED THROUGH PROs (Full width pivot)
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
      if (pivotRows.length > 0) {
        pivotRows.push([
          'Subtotal',
          ...report.additionalColumns.map(col => {
            const colSum = validPivotRows.reduce((sum, r) => sum + (r[col] || 0), 0);
            return '₹' + colSum.toLocaleString('en-IN');
          }),
          '₹' + report.additionalSubtotal.toLocaleString('en-IN')
        ]);
      }

      const pivotColumnStyles = {
        0: { fontStyle: 'bold' }
      };
      report.additionalColumns.forEach((col, idx) => {
        pivotColumnStyles[idx + 1] = { halign: 'right' };
      });
      pivotColumnStyles[report.additionalColumns.length + 1] = { halign: 'right', fontStyle: 'bold' };

      const pivotBody = pivotRows.length > 0 ? pivotRows : [['No direct collections', '₹0']];
      
      renderSectionHeader('DIRECT COLLECTIONS RECEIVED THROUGH PROs', pivotBody.length);
      const pageBeforePivot = doc.internal.getCurrentPageInfo().pageNumber;
      const pivotStartY = currentY;

      doc.autoTable({
        ...tableOptions,
        head: pivotHeaders,
        body: pivotBody,
        startY: currentY,
        columnStyles: pivotColumnStyles,
        didParseCell: function(data) {
          if (pivotRows.length > 0 && data.row.index === subtotalRowIdx && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 245];
          }
          // Default cell amount formatting logic
          if (data.section === 'body') {
            const text = data.cell.text.join('').trim();
            if (text.startsWith('₹') || data.column.dataKey === 'amount' || data.column.dataKey === 'total') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.halign = 'right';
            }
          }
        }
      });
      drawTableOuterBorder(doc.lastAutoTable, pageBeforePivot, pivotStartY, 190);
      currentY = doc.lastAutoTable.finalY;

      // =========================================================================
      // PAGE 2: PRO COLLECTION DETAIL (No STATUS column)
      // =========================================================================
      const proDetailRows = (report.allContributors && report.allContributors.length > 0)
        ? report.allContributors.map(c => [
            c.name,
            '₹' + (c.takafulAmount || 0).toLocaleString('en-IN'),
            '₹' + (c.additionalAmount || 0).toLocaleString('en-IN'),
            '₹' + (c.amount || 0).toLocaleString('en-IN')
          ])
        : [['No contributor detail available', '₹0', '₹0', '₹0']];

      renderSectionHeader('PRO COLLECTION DETAIL', proDetailRows.length);
      const pageBeforeDetail = doc.internal.getCurrentPageInfo().pageNumber;
      const detailStartY = currentY;

      doc.autoTable({
        ...tableOptions,
        head: [['PRO NAME', 'COLLECTION (TAKAFUL)', 'ADDITIONAL COLLECTION', 'TOTAL PERFORMANCE']],
        body: proDetailRows,
        startY: currentY,
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { cellWidth: 45 },
          2: { cellWidth: 45 },
          3: { cellWidth: 45 }
        }
      });
      drawTableOuterBorder(doc.lastAutoTable, pageBeforeDetail, detailStartY, 190);
      currentY = doc.lastAutoTable.finalY;

      // =========================================================================
      // PAGE 2: RANKINGS (No STATUS column)
      // =========================================================================
      const rankTitle = report.collectionFilterCode === 'all' ? 'CATEGORY RANKINGS' : 'RANKINGS';
      const isAllFilter = report.collectionFilterCode === 'all';
      const detailedHeaders = isAllFilter
        ? [['RANK', 'CATEGORY', 'COLLECTION AMOUNT', 'CONTRIBUTION %']]
        : [['RANK', 'PRO NAME', 'COLLECTION AMOUNT', 'CONTRIBUTION %']];

      const sortedDetailedRows = [...report.detailedReport.rows].sort((a, b) => b.amount - a.amount);
      const detailedRows = sortedDetailedRows.map(r => {
        return [String(r.rank), r.name, '₹' + r.amount.toLocaleString('en-IN'), `${r.pct}%`];
      });

      renderSectionHeader(rankTitle, detailedRows.length);
      const pageBeforeRankings = doc.internal.getCurrentPageInfo().pageNumber;
      const rankingsStartY = currentY;

      doc.autoTable({
        ...tableOptions,
        head: detailedHeaders,
        body: detailedRows,
        startY: currentY,
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          1: { fontStyle: 'bold' },
          2: { halign: 'right', fontStyle: 'bold', cellWidth: 50 },
          3: { halign: 'right', cellWidth: 35 }
        }
      });
      drawTableOuterBorder(doc.lastAutoTable, pageBeforeRankings, rankingsStartY, 190);
      currentY = doc.lastAutoTable.finalY;

      // =========================================================================
      // GRAND TOTAL FOOTER BLOCK
      // =========================================================================
      // Check space for Grand Total
      if (currentY + 18 > pageHeight - 25) {
        doc.addPage();
        currentY = 38;
      } else {
        currentY += 6; // Spacing between sections is 6mm
      }

      const totalText = `GRAND TOTAL : ₹${report.grandTotal.toLocaleString('en-IN')}`;
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(16);
      const textWidth = doc.getTextWidth(totalText);
      const boxWidth = textWidth + 20; // compact padding
      const boxHeight = 12;
      const boxX = 105 - (boxWidth / 2);

      doc.setDrawColor(13, 27, 42); // Dark Blue border
      doc.setLineWidth(0.6); // ~2px border
      doc.setFillColor(255, 253, 230); // Light Yellow #FFFDE6
      doc.rect(boxX, currentY, boxWidth, boxHeight, 'FD'); // Filled and stroked

      doc.setTextColor(13, 27, 42); // Dark Blue text
      doc.text(totalText, 105, currentY + 8.5, { align: 'center' }); // Centered text

      // =========================================================================
      // POST-PROCESSING: Dynamic Headers, Footers, and Page Numbers
      // =========================================================================
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // 1. Dark Blue Header Strip
        doc.setFillColor(13, 27, 42); // Dark Blue
        doc.rect(10, 10, 190, 18, 'F');
        
        // 2. Centered Gold Title
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(245, 197, 24); // Gold #F5C518
        doc.text(report.title || 'TAKAFUL FINANCIAL YEAR REPORT', 105, 17, { align: 'center' });
        
        // 3. Centered Small Gray Subtitle
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(220, 220, 220); // Light Gray
        doc.text(report.subtitle || 'FY 2026-27', 105, 23, { align: 'center' });
        
        // 4. Horizontal Divider Line
        doc.setDrawColor(102, 102, 102); // Dark Gray #666
        doc.setLineWidth(0.4);
        doc.line(10, 32, 200, 32);
        
        // 5. Footer Details
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        
        // Left: Verified By
        doc.text('Verified By ___________________', 10, 287);
        
        // Center: Generated On: Date & Time
        const genTime = new Date(report.generatedAt || new Date()).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        doc.text(`Generated On: ${genTime}`, 105, 287, { align: 'center' });
        
        // Right: Page: X of N
        doc.text(`Page: ${i} of ${pageCount}`, 200, 287, { align: 'right' });
      }

      const fileFilter = selectedModule ? selectedModule.name.replace(/\s+/g, '_') : 'All';
      doc.save(`Takaful_Report_${report.subtitle.replace(/[^a-zA-Z0-9]/g, '_')}_${fileFilter}.s`);
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

                {/* Financial Summary (Expense & Balance) */}
                <div className="border border-white/10 rounded-xl py-3.5 px-6 bg-white/[0.02] mt-6 flex flex-wrap justify-around items-center text-center gap-4">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Total Collection</span>
                    <span className="text-sm font-extrabold text-white mt-1 block">
                      ₹{report.collectionSummary.total.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="h-8 w-[1px] bg-white/10 hidden sm:block" />
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Total Expense</span>
                    <span className="text-sm font-extrabold text-rose-400 mt-1 block">
                      ₹{(report.totalExpense || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="h-8 w-[1px] bg-white/10 hidden sm:block" />
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Net Balance</span>
                    <span className="text-sm font-extrabold text-gold mt-1 block">
                      ₹{(report.netBalance || 0).toLocaleString('en-IN')}
                    </span>
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
                      </tr>
                    </thead>
                    <tbody>
                      {[...report.detailedReport.rows].sort((a, b) => b.amount - a.amount).map(r => (
                        <tr key={r.name} className="border-b border-[#444] hover:bg-white/[0.01] align-middle">
                          <td className="p-[7px_8px] border border-[#444] font-semibold text-white">{r.name}</td>
                          <td className="p-[7px_8px] border border-[#444] text-right font-bold text-white min-w-[100px] whitespace-nowrap">₹{r.amount.toLocaleString('en-IN')}</td>
                          <td className="p-[7px_8px] border border-[#444] text-right text-gray-300 min-w-[100px] whitespace-nowrap">{r.pct}%</td>
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
