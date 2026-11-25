import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Target } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { realAdapter } from '../services/realAdapter'
import { calculatePercentage, currentMonthKey, formatINR, formatMonthKey } from '../utils/format'

export default function Budgets() {
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [month] = useState(currentMonthKey)

  useEffect(() => {
    let active = true
    realAdapter.getBudgets({ month })
      .then(result => { if (active) setBudgets(result.budgets) })
      .catch(err => { if (active) setError(err.message || 'Could not load budgets.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [month])

  const totalLimit = budgets.reduce((sum, budget) => sum + budget.limit, 0)
  const totalUsed = budgets.reduce((sum, budget) => sum + budget.used, 0)
  const overallPercent = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <p className="text-label-sm uppercase tracking-wider text-primary">Control center</p>
        <h1 className="headline-lg text-on-surface font-semibold">Monthly budgets</h1>
        <p className="body-md text-secondary">Keep category spending aligned with your {formatMonthKey(month)} plan.</p>
      </div>
      {error && <ErrorAlert message={error} />}
      <Card className="bg-inverse-surface text-inverse-on-surface">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-inverse-on-surface/70">Total allocated</p>
            <p className="mt-1 text-3xl font-bold">{formatINR(totalLimit)}</p>
          </div>
          <div>
            <p className="text-sm text-inverse-on-surface/70">Used this month</p>
            <p className="mt-1 text-3xl font-bold text-primary-fixed">{formatINR(totalUsed)}</p>
          </div>
          <div className="min-w-48">
            <div className="mb-2 flex justify-between text-xs text-inverse-on-surface/70">
              <span>Overall utilization</span><span>{Math.round(overallPercent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-primary-fixed" style={{ width: `${Math.min(100, overallPercent)}%` }} />
            </div>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {budgets.map(budget => {
          const percentage = calculatePercentage(budget.used, budget.limit)
          const over = budget.used > budget.limit
          return (
            <Card key={budget.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><Target size={18} /></div>
                  <div><h2 className="font-semibold text-on-surface">{budget.categoryName}</h2><p className="text-xs text-secondary">Monthly allocation</p></div>
                </div>
                <Badge variant={over ? 'warning' : 'neutral'}>{over ? 'Over budget' : `${Math.round(percentage)}%`}</Badge>
              </div>
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm"><span>{formatINR(budget.used)} spent</span><span className="text-secondary">of {formatINR(budget.limit)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                  <div className={`h-full rounded-full ${over ? 'bg-error' : percentage >= 80 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(100, percentage)}%` }} />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-secondary">
                  {over ? <AlertTriangle size={14} className="text-error" /> : <CheckCircle2 size={14} className="text-primary" />}
                  {over ? `${formatINR(budget.used - budget.limit)} over limit` : `${formatINR(budget.limit - budget.used)} remaining`}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      {!loading && !error && budgets.length === 0 && (
        <Card className="text-center text-secondary">
          No budgets set for {formatMonthKey(month)} yet. Budgets you add during setup appear here.
        </Card>
      )}
    </div>
  )
}
