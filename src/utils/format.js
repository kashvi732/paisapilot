import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'

export function formatINR(amountPaise, options = {}) {
  const { showSymbol = true, compact = false, showPaise = false } = options
  
  const rupees = amountPaise / 100
  
  if (compact && Math.abs(rupees) >= 100000) {
    const crores = rupees / 10000000
    if (crores >= 1) {
      return `${showSymbol ? '₹' : ''}${crores.toFixed(1)}Cr`
    }
    const lakhs = rupees / 100000
    return `${showSymbol ? '₹' : ''}${lakhs.toFixed(1)}L`
  }
  
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  }).format(rupees)
  
  return showSymbol ? formatted : formatted.replace('₹', '').trim()
}

export function formatINRCompact(amountPaise) {
  return formatINR(amountPaise, { compact: true })
}

export function formatNumber(num, options = {}) {
  return new Intl.NumberFormat('en-IN', options).format(num)
}

export function formatDate(date, pattern = 'MMM d, yyyy') {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return format(d, pattern)
}

export function formatDateTime(date, pattern = 'MMM d, yyyy · h:mm a') {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return format(d, pattern)
}

export function formatMonthYear(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return format(d, 'MMMM yyyy')
}

export function formatShortDate(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return format(d, 'dd MMM')
}

export function getMonthBounds(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return {
    start: startOfMonth(d),
    end: endOfMonth(d),
  }
}

export function getMonthRange(monthsBack = 0) {
  const base = subMonths(new Date(), monthsBack)
  return getMonthBounds(base)
}

export function getMonthsArray(count = 6, endDate = new Date()) {
  const months = []
  for (let i = count - 1; i >= 0; i--) {
    const date = subMonths(endDate instanceof Date ? endDate : new Date(endDate), i)
    months.push({
      key: format(date, 'yyyy-MM'),
      label: format(date, 'MMM yyyy'),
      shortLabel: format(date, 'MMM'),
      start: startOfMonth(date),
      end: endOfMonth(date),
    })
  }
  return months
}

export function getDaysInMonth(date) {
  const d = date instanceof Date ? date : new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth()
  return new Date(year, month + 1, 0).getDate()
}

export function isSameMonth(date1, date2) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1)
  const d2 = date2 instanceof Date ? date2 : new Date(date2)
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
}

export function parseINRString(str) {
  if (!str) return 0
  const cleaned = str.replace(/[₹,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.round(num * 100)
}

export function calculateSavingsRate(income, expense) {
  if (income <= 0) return 0
  return Math.max(0, Math.min(100, ((income - expense) / income) * 100))
}

export function calculatePercentage(part, total) {
  if (total <= 0) return 0
  return Math.min(100, (part / total) * 100)
}
// Month keys ("yyyy-MM") are always derived from the browser's local calendar.
// Using toISOString() here would report the previous month or day for users
// ahead of UTC (for example, IST before 05:30).
export function currentMonthKey(date = new Date()) {
  return format(date, 'yyyy-MM')
}

export function monthKeyToDate(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

export function shiftMonthKey(monthKey, delta) {
  return format(addMonths(monthKeyToDate(monthKey), delta), 'yyyy-MM')
}

export function formatMonthKey(monthKey) {
  return monthKeyToDate(monthKey).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

// Value for <input type="datetime-local">, which expects local wall-clock time.
export function toDateTimeLocalValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, "yyyy-MM-dd'T'HH:mm")
}
