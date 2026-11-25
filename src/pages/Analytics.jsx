import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, Download, PieChart as PieChartIcon } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { DonutChart } from '../components/charts/DonutChart'
import { BarChart } from '../components/charts/BarChart'
import { realAdapter } from '../services/realAdapter'
import { useAuth } from '../context/AuthContext'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { currentMonthKey, formatINR, formatMonthKey } from '../utils/format'

export default function Analytics() {
  const { user } = useAuth()
  const [report, setReport] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [CURRENT_MONTH] = useState(currentMonthKey)
  const CURRENT_MONTH_LABEL = formatMonthKey(CURRENT_MONTH)

  useEffect(() => {
    let active = true
    realAdapter.getDashboardReport({ month: CURRENT_MONTH })
      .then(result => { if (active) setReport(result) })
      .catch(err => { if (active) setError(err.message || 'Could not load analytics.') })
    return () => { active = false }
  }, [CURRENT_MONTH])

  const exportCsv = async () => {
    setExporting(true)
    setError('')
    try {
      // The API resolves the month in the user's timezone, matching the report.
      const blob = await realAdapter.exportReport({ month: CURRENT_MONTH })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `paisapilot-${CURRENT_MONTH}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoking synchronously can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (err) {
      setError(err.message || 'Could not export the report.')
    } finally {
      setExporting(false)
    }
  }
  if (!report && error) return <ErrorAlert message={error} />
  if (!report) return <div className="p-12 text-center text-secondary">Loading analytics…</div>

  const baseSalary = user?.monthlyIncomePaise || 0
  const grossIncome = baseSalary > 0
    ? (report.income >= baseSalary ? report.income : baseSalary + report.income)
    : report.income
  const grossExpense = report.expense || 0
  const netSavings = grossIncome - grossExpense
  const grossSavingsRate = grossIncome > 0
    ? Math.max(0, Number(((netSavings / grossIncome) * 100).toFixed(0)))
    : 0

  const effectiveMonthlyTrend = (report.monthlyTrend || []).map(m => {
    if (m.month === CURRENT_MONTH && baseSalary > 0) {
      const inc = Math.max(m.income, grossIncome)
      return { ...m, income: inc, balance: inc - m.expense }
    }
    return m
  })

  const { categorySpending } = report

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-wider text-primary">Financial intelligence</p>
          <h1 className="headline-lg text-on-surface font-semibold">Analytics</h1>
          <p className="body-md text-secondary">Understand the patterns behind your {CURRENT_MONTH_LABEL} cash flow.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv} loading={exporting}>
          <Download size={16} /> Export CSV
        </Button>
      </div>
      {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Gross Income" value={formatINR(grossIncome)} icon={<ArrowUpRight />} tone="text-income" />
        <Metric label="Expenses" value={formatINR(grossExpense)} icon={<ArrowDownRight />} tone="text-expense" />
        <Metric label="Savings rate" value={`${grossSavingsRate}%`} icon={<BarChart3 />} tone="text-primary" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><div className="mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-primary" /><h2 className="font-semibold">Cash flow trend</h2></div><BarChart data={effectiveMonthlyTrend} height={300} /></Card>
        <Card><div className="mb-4 flex items-center gap-2"><PieChartIcon size={18} className="text-primary" /><h2 className="font-semibold">Expense mix</h2></div><DonutChart data={categorySpending} width={320} height={300} /></Card>
      </div>
    </div>
  )
}

function Metric({ label, value, icon, tone }) {
  return <Card><div className="flex items-center justify-between"><span className="text-sm text-secondary">{label}</span><span className={tone}>{icon}</span></div><p className="mt-3 text-2xl font-bold text-on-surface">{value}</p></Card>
}
