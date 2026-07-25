import ExcelJS from 'exceljs'
import type { ExportPayload } from './export-data'

/**
 * Sinh file Excel từ dữ liệu đã gom.
 *
 * Nguyên tắc: định dạng số **ở tầng Excel** (`numFmt`), không biến số thành
 * chuỗi. Người nhận cần cộng, lọc và vẽ biểu đồ trên chính file này. Cũng vì
 * vậy không rút gọn "1,2 tỷ" — luôn ghi giá trị thật.
 */

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' },
}

function numberFormat(unit: string): string {
  if (unit === 'VND') return '#,##0'
  if (unit === '%') return '0.0'
  if (unit === 'lần') return '0.00'
  return '#,##0'
}

function formatDateVi(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatDateTimeVi(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export async function buildExcel(payload: ExportPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MPMS'
  workbook.created = payload.meta.generatedAt

  buildOverviewSheet(workbook, payload)
  buildDetailSheet(workbook, payload)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function writeHeaderBlock(sheet: ExcelJS.Worksheet, payload: ExportPayload, columns: number) {
  // Người nhận file phải biết ngay đây là báo cáo gì, kỳ nào, ai xuất.
  const lines: Array<[string, string]> = [
    ['Báo cáo', payload.meta.title],
    ['Kỳ', payload.meta.periodLabel],
    [
      'Khoảng thời gian',
      `${formatDateVi(payload.meta.periodStart)} – ${formatDateVi(payload.meta.periodEnd)}`,
    ],
    ['Phạm vi', payload.meta.departmentFilter],
    ['Thời điểm xuất', formatDateTimeVi(payload.meta.generatedAt)],
    ['Người xuất', payload.meta.generatedBy],
  ]

  lines.forEach(([label, value], index) => {
    const row = sheet.getRow(index + 1)
    row.getCell(1).value = label
    row.getCell(1).font = { bold: true, size: 10 }
    row.getCell(2).value = value
    row.getCell(2).font = { size: 10 }
  })

  sheet.mergeCells(1, 2, 1, Math.min(columns, 4))
  sheet.addRow([])
}

function buildOverviewSheet(workbook: ExcelJS.Workbook, payload: ExportPayload) {
  const sheet = workbook.addWorksheet('Tổng quan')
  writeHeaderBlock(sheet, payload, 4)

  const headerRow = sheet.addRow(['Bộ phận', 'Điểm KPI', 'Xếp loại'])
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
  })

  for (const row of payload.summary) {
    const added = sheet.addRow([row.departmentName, row.score, row.grade])
    added.getCell(2).numFmt = '0.0'
    // Chưa có điểm khác với điểm 0 — để ô trống thay vì ghi 0.
    if (row.score === null) added.getCell(2).value = null
    if (row.grade === null) added.getCell(3).value = null
  }

  sheet.getColumn(1).width = 32
  sheet.getColumn(2).width = 12
  sheet.getColumn(3).width = 12
  sheet.views = [{ state: 'frozen', ySplit: headerRow.number }]
}

function buildDetailSheet(workbook: ExcelJS.Workbook, payload: ExportPayload) {
  const sheet = workbook.addWorksheet('Chi tiết KPI')
  writeHeaderBlock(sheet, payload, 8)

  const headers = [
    'Bộ phận',
    'Chỉ số',
    'Mã',
    'Đơn vị',
    'Chiều',
    'Mục tiêu',
    'Thực tế',
    '% đạt',
  ]
  const headerRow = sheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
  })

  for (const row of payload.rows) {
    const added = sheet.addRow([
      row.departmentName,
      row.metricName,
      row.metricCode,
      row.unit,
      row.direction,
      row.target,
      row.actual,
      row.attainment,
    ])

    const format = numberFormat(row.unit)
    added.getCell(6).numFmt = format
    added.getCell(7).numFmt = format
    added.getCell(8).numFmt = '0.0%'

    // null = chưa xác định (mẫu số 0, chưa có dữ liệu). Để trống, không ghi 0.
    if (row.target === null) added.getCell(6).value = null
    if (row.actual === null) added.getCell(7).value = null
    if (row.attainment === null) added.getCell(8).value = null
  }

  sheet.getColumn(1).width = 28
  sheet.getColumn(2).width = 24
  sheet.getColumn(3).width = 16
  sheet.getColumn(4).width = 10
  sheet.getColumn(5).width = 14
  sheet.getColumn(6).width = 16
  sheet.getColumn(7).width = 16
  sheet.getColumn(8).width = 10

  sheet.views = [{ state: 'frozen', ySplit: headerRow.number }]
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: headers.length },
  }
}

/** Tên file: không dấu, không khoảng trắng, có ngữ nghĩa để tra lại về sau. */
export function buildFileName(payload: ExportPayload, extension: string): string {
  const stamp = payload.meta.generatedAt.toISOString().slice(0, 10).replace(/-/g, '')
  const period = payload.meta.periodLabel
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '')
  return `MPMS_BaoCaoKPI_${period}_${stamp}.${extension}`
}
