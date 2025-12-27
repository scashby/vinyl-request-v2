// src/lib/pdfGenerator.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Album } from 'types/album';
import { ColumnId, COLUMN_DEFINITIONS } from 'src/app/edit-collection/columnDefinitions';

interface SortField {
  column: ColumnId;
  direction: 'asc' | 'desc';
}

interface PDFOptions {
  albums: Album[];
  columns: ColumnId[];
  sortFields: SortField[];
  layout: 'portrait' | 'landscape';
  title: string;
  margins: string;
  fontType: string;
  fontSize: number;
  fontColor: string;
  titleOnEveryPage: boolean;
  maxAlbumsPerPage: number | null;
  pageNumbers: boolean;
  printDateTime: boolean;
  coverThumbnails: boolean;
  columnFieldNames: boolean;
  rowShading: boolean;
  borderStyle: 'none' | 'middle' | 'outside' | 'all';
}

function sortAlbums(albums: Album[], sortFields: SortField[]): Album[] {
  return [...albums].sort((a, b) => {
    for (const field of sortFields) {
      const colId = field.column;
      const aVal = a[colId as keyof Album];
      const bVal = b[colId as keyof Album];
      
      let comparison = 0;
      
      if (aVal === null || aVal === undefined) comparison = 1;
      else if (bVal === null || bVal === undefined) comparison = -1;
      else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (Array.isArray(aVal) && Array.isArray(bVal)) {
        comparison = aVal.join(',').localeCompare(bVal.join(','));
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      
      if (comparison !== 0) {
        return field.direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
}

function formatValue(value: unknown, columnId: ColumnId): string {
  if (value === null || value === undefined) return '—';
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  // Handle dates
  if (columnId.includes('date') && typeof value === 'string') {
    try {
      const date = new Date(value);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(value);
    }
  }
  
  // Handle lengths (length is stored as formatted string like "42:15")
  if (columnId === 'length' && typeof value === 'string') {
    return value;
  }
  
  // Handle currency
  if ((columnId.includes('price') || columnId.includes('value') || columnId.includes('cost')) && typeof value === 'number') {
    return `$${value.toFixed(2)}`;
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  // Handle ratings
  if (columnId === 'my_rating' && typeof value === 'number') {
    return '★'.repeat(value);
  }
  
  return String(value);
}

function getMarginValue(margins: string): number {
  switch (margins) {
    case 'none': return 5;
    case 'small': return 10;
    case 'medium': return 15;
    case 'large': return 20;
    default: return 15;
  }
}

function getFontName(fontType: string): string {
  switch (fontType) {
    case 'arial': return 'helvetica';
    case 'helvetica': return 'helvetica';
    case 'times': return 'times';
    case 'courier': return 'courier';
    default: return 'helvetica';
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : [0, 0, 0];
}

export async function generatePDF(options: PDFOptions): Promise<void> {
  const {
    albums,
    columns,
    sortFields,
    layout,
    title,
    margins,
    fontType,
    fontSize,
    fontColor,
    titleOnEveryPage,
    pageNumbers,
    printDateTime,
    columnFieldNames,
    rowShading,
    borderStyle
  } = options;

  // Note: maxAlbumsPerPage and coverThumbnails are in PDFOptions but not yet implemented
  // They can be added to the destructuring when implemented

  // Sort albums
  const sortedAlbums = sortAlbums(albums, sortFields);
  
  // Create PDF
  const doc = new jsPDF({
    orientation: layout,
    unit: 'mm',
    format: 'a4'
  });

  const marginValue = getMarginValue(margins);
  const font = getFontName(fontType);
  const [r, g, b] = hexToRgb(fontColor);

  // Set default font
  doc.setFont(font);
  doc.setFontSize(fontSize);
  doc.setTextColor(r, g, b);

  // Calculate page dimensions
  const pageWidth = layout === 'portrait' ? 210 : 297;
  const pageHeight = layout === 'portrait' ? 297 : 210;
  const contentWidth = pageWidth - (marginValue * 2);

  let currentY = marginValue;

  // Add title
  const addTitle = (isFirstPage = false) => {
    if (isFirstPage || titleOnEveryPage) {
      doc.setFontSize(fontSize + 4);
      doc.setFont(font, 'bold');
      doc.text(title, pageWidth / 2, currentY, { align: 'center' });
      currentY += 8;
      doc.setFontSize(fontSize);
      doc.setFont(font, 'normal');
    }
  };

  addTitle(true);

  // Add date/time
  if (printDateTime) {
    const now = new Date().toLocaleString();
    doc.setFontSize(fontSize - 2);
    doc.text(now, pageWidth / 2, currentY, { align: 'center' });
    currentY += 6;
    doc.setFontSize(fontSize);
  }

  // Prepare table headers
  const headers = columnFieldNames
    ? [columns.map(colId => COLUMN_DEFINITIONS[colId]?.label || colId)]
    : [];

  // Prepare table data
  const data = sortedAlbums.map(album => 
    columns.map(colId => formatValue(album[colId as keyof Album], colId))
  );

  // Calculate column widths
  const columnCount = columns.length;
  const baseColumnWidth = contentWidth / columnCount;
  const columnStyles: { [key: number]: { cellWidth: number } } = {};
  
  columns.forEach((_, index) => {
    columnStyles[index] = { cellWidth: baseColumnWidth };
  });

  // Configure borders
  let lineWidth = 0.1;
  const lineColor: [number, number, number] = [200, 200, 200];
  
  if (borderStyle === 'none') {
    lineWidth = 0;
  } else if (borderStyle === 'outside') {
    lineWidth = 0.3;
  } else if (borderStyle === 'all') {
    lineWidth = 0.2;
  }

  // Generate table with autoTable
  autoTable(doc, {
    head: headers,
    body: data,
    startY: currentY,
    margin: { left: marginValue, right: marginValue },
    styles: {
      fontSize: fontSize,
      font: font,
      textColor: [r, g, b],
      cellPadding: 2,
      lineColor: lineColor,
      lineWidth: lineWidth,
    },
    headStyles: {
      fillColor: columnFieldNames ? [240, 240, 240] : false,
      textColor: [r, g, b],
      fontStyle: 'bold',
      lineWidth: borderStyle === 'outside' || borderStyle === 'all' ? 0.3 : 0,
    },
    bodyStyles: {
      fillColor: false,
    },
    alternateRowStyles: rowShading ? {
      fillColor: [250, 250, 250]
    } : {},
    columnStyles: columnStyles,
    didDrawPage: (data) => {
      // Add page numbers
      if (pageNumbers) {
        const pageNum = doc.getCurrentPageInfo().pageNumber;
        doc.setFontSize(fontSize - 2);
        doc.text(
          `Page ${pageNum}`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
        doc.setFontSize(fontSize);
      }

      // Add title on subsequent pages
      if (data.pageNumber > 1 && titleOnEveryPage) {
        currentY = marginValue;
        addTitle(false);
      }
    },
    didParseCell: (data) => {
      // Apply border styles
      if (borderStyle === 'middle') {
        // Only internal borders
        if (data.row.index === 0) {
          data.cell.styles.lineWidth = { top: 0, right: lineWidth, bottom: lineWidth, left: 0 };
        } else if (data.row.index === data.table.body.length - 1) {
          data.cell.styles.lineWidth = { top: lineWidth, right: lineWidth, bottom: 0, left: 0 };
        } else {
          data.cell.styles.lineWidth = { top: lineWidth, right: lineWidth, bottom: lineWidth, left: 0 };
        }
        
        if (data.column.index === 0) {
          data.cell.styles.lineWidth = { 
            ...data.cell.styles.lineWidth, 
            left: 0 
          };
        }
        if (data.column.index === data.table.columns.length - 1) {
          data.cell.styles.lineWidth = { 
            ...data.cell.styles.lineWidth, 
            right: 0 
          };
        }
      } else if (borderStyle === 'outside') {
        // Only outside border
        const isTop = data.row.index === 0;
        const isBottom = data.row.index === data.table.body.length - 1;
        const isLeft = data.column.index === 0;
        const isRight = data.column.index === data.table.columns.length - 1;
        
        data.cell.styles.lineWidth = {
          top: isTop ? lineWidth : 0,
          right: isRight ? lineWidth : 0,
          bottom: isBottom ? lineWidth : 0,
          left: isLeft ? lineWidth : 0
        };
      }
    },
    showHead: columnFieldNames ? 'everyPage' : 'never',
    theme: 'plain',
    tableWidth: 'auto',
    rowPageBreak: 'avoid',
  });

  // Save the PDF
  const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}