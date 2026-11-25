import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Filter, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { Table } from '../components/ui/Table'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { TransactionForm } from '../components/forms/TransactionForm'
import { realAdapter } from '../services/realAdapter'
import { formatINR, formatShortDate } from '../utils/format'
import { cn } from '../utils/cn'

const PAGE_SIZE = 50

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [category, setCategory] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [error, setError] = useState('')
  const latestRequest = useRef(0)

  // Any filter change starts again from the first page (batched into one load).
  const withPageReset = setter => value => {
    setter(value)
    setPage(1)
  }

  const loadTransactions = useCallback(async () => {
    const requestId = ++latestRequest.current
    setLoading(true)
    setError('')
    try {
      const result = await realAdapter.getTransactions({
        page,
        limit: PAGE_SIZE,
        type,
        category,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      })
      // Ignore responses that arrive after a newer filter request was sent.
      if (requestId !== latestRequest.current) return
      setTransactions(result.transactions)
      setPagination({ total: result.total, totalPages: result.totalPages })
    } catch (err) {
      if (requestId !== latestRequest.current) return
      setError(err.message || 'Could not load transactions.')
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [page, type, category, from, to])

  useEffect(() => { loadTransactions() }, [loadTransactions])
  useEffect(() => {
    realAdapter.getCategories()
      .then(result => setCategories(result.categories))
      .catch(err => setError(err.message || 'Could not load categories.'))
  }, [])

  const visibleTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return transactions
    return transactions.filter(transaction =>
      [transaction.note, transaction.categoryName, transaction.paymentMode, transaction.paymentAccount]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(normalizedQuery))
    )
  }, [query, transactions])

  const handleSave = async payload => {
    if (payload.id) {
      await realAdapter.updateTransaction(payload.id, payload)
    } else {
      await realAdapter.createTransaction(payload)
    }
    setShowAddModal(false)
    setEditingTransaction(null)
    loadTransactions()
  }

  const handleDelete = async transaction => {
    if (!window.confirm(`Delete "${transaction.note || transaction.categoryName}"?`)) return
    try {
      await realAdapter.deleteTransaction(transaction.id)
      // Step back if the last row on a later page was removed.
      if (transactions.length === 1 && page > 1) setPage(value => value - 1)
      else loadTransactions()
    } catch (err) {
      setError(err.message || 'Could not delete the transaction.')
    }
  }

  const columns = [
    {
      key: 'transaction',
      label: 'Transaction',
      render: transaction => (
        <div>
          <div className="font-semibold text-on-surface">{transaction.note || transaction.categoryName}</div>
          <div className="text-xs text-secondary">{transaction.paymentAccount || transaction.paymentMode}</div>
        </div>
      ),
    },
    { key: 'categoryName', label: 'Category' },
    { key: 'date', label: 'Date', render: transaction => formatShortDate(transaction.date) },
    { key: 'paymentMode', label: 'Method' },
    {
      key: 'type',
      label: 'Type',
      align: 'center',
      render: transaction => <Badge variant={transaction.type === 'income' ? 'income' : 'expense'}>{transaction.type}</Badge>,
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: transaction => (
        <span className={cn('font-semibold', transaction.type === 'income' ? 'text-income' : 'text-expense')}>
          {transaction.type === 'income' ? '+' : '-'}{formatINR(transaction.amount)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: transaction => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditingTransaction(transaction)} className="rounded-md p-2 text-secondary hover:bg-surface-container-high hover:text-on-surface" aria-label={`Edit ${transaction.note || transaction.categoryName}`}>
            <Pencil size={15} />
          </button>
          <button type="button" onClick={() => handleDelete(transaction)} className="rounded-md p-2 text-error hover:bg-error/10" aria-label={`Delete ${transaction.note || transaction.categoryName}`}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-wider text-primary">Ledger</p>
          <h1 className="headline-lg text-on-surface font-semibold">Transactions</h1>
          <p className="body-md text-secondary">Search and organize every inflow and outflow in your ledger.</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}><Plus size={17} /> Add transaction</Button>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline/30 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              aria-label="Search transactions"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search notes, categories, or payment methods"
              className="input-base pl-10"
            />
          </div>
          <Button variant="secondary" onClick={() => setShowFilters(value => !value)}>
            <SlidersHorizontal size={16} /> Filters <Filter size={14} />
          </Button>
          {(query || type || category || from || to) && (
            <Button variant="ghost" onClick={() => { setQuery(''); setType(''); setCategory(''); setFrom(''); setTo(''); setPage(1) }}>
              <X size={15} /> Clear
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="grid gap-4 border-b border-outline/30 bg-surface-container-low p-4 sm:grid-cols-2">
            <Select label="Type" value={type} onChange={withPageReset(setType)} placeholder="All types" clearable options={[
              { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' },
            ]} />
            <Select label="Category" value={category} onChange={withPageReset(setCategory)} placeholder="All categories" clearable
              options={categories.map(item => ({ value: item.id, label: item.name }))} />
            <label className="flex flex-col gap-2 text-label-sm uppercase tracking-wider text-secondary">
              From
              <input aria-label="Filter from date" type="date" value={from} onChange={event => withPageReset(setFrom)(event.target.value)} className="input-base" />
            </label>
            <label className="flex flex-col gap-2 text-label-sm uppercase tracking-wider text-secondary">
              To
              <input aria-label="Filter to date" type="date" value={to} onChange={event => withPageReset(setTo)(event.target.value)} className="input-base" />
            </label>
          </div>
        )}
        {error && <ErrorAlert message={error} onDismiss={() => setError('')} className="m-4" />}
        {loading ? (
          <div className="p-12 text-center text-secondary">Loading ledger…</div>
        ) : (
          <Table columns={columns} data={visibleTransactions} />
        )}
        <div className="flex flex-col gap-3 border-t border-outline/30 px-4 py-3 text-sm text-secondary sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {visibleTransactions.length} of {pagination.total} transactions
            {query.trim() && transactions.length !== visibleTransactions.length ? ' (search applies to this page)' : ''}
          </span>
          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>
                Previous
              </Button>
              <span>Page {page} of {pagination.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages || loading} onClick={() => setPage(value => value + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      </Card>
      <TransactionForm
        isOpen={showAddModal || !!editingTransaction}
        transaction={editingTransaction}
        onClose={() => { setShowAddModal(false); setEditingTransaction(null) }}
        onSave={handleSave}
        categories={categories}
      />
    </div>
  )
}
