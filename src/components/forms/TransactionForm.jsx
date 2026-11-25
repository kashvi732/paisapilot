import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { cn } from '../../utils/cn'
import { TRANSACTION_TYPES, RECURRENCE_FREQUENCIES } from '../../utils/constants'
import { parseINRString, toDateTimeLocalValue } from '../../utils/format'
import { transactionSchema } from '../../utils/validation'
import { ErrorAlert } from '../ui/ErrorAlert'

export function TransactionForm({ isOpen, onClose, onSave, transaction = null, categories = [] }) {
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    categoryId: '',
    date: toDateTimeLocalValue(),
    paymentMode: 'upi',
    note: '',
    isRecurring: false,
    recurrence: {
      frequency: 'monthly',
      interval: 1,
    },
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setForm({
      type: transaction?.type || 'expense',
      amount: transaction ? String(transaction.amount / 100) : '',
      categoryId: transaction?.categoryId || '',
      // The API returns UTC instants; datetime-local inputs expect local time.
      // Slicing the ISO string would shift the saved time by the UTC offset on every edit.
      date: transaction?.date ? toDateTimeLocalValue(transaction.date) : toDateTimeLocalValue(),
      paymentMode: transaction?.paymentMode || 'upi',
      note: transaction?.note || '',
      isRecurring: transaction?.isRecurring || false,
      recurrence: transaction?.recurrence || { frequency: 'monthly', interval: 1 },
    })
    setErrors({})
    setSubmitError('')
    setSaving(false)
  }, [isOpen, transaction])

  const handleTypeChange = (type) => {
    setForm(prev => ({ ...prev, type }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    const newErrors = {}
    if (!form.type) newErrors.type = 'Type is required'
    if (!/^\d+(\.\d{1,2})?$/.test(form.amount.trim()) || parseINRString(form.amount) <= 0) {
      newErrors.amount = 'Enter a positive amount with up to two decimals'
    }
    if (!form.categoryId) newErrors.categoryId = 'Category is required'
    if (!form.date || Number.isNaN(new Date(form.date).getTime())) newErrors.date = 'Valid date is required'
    if (!form.paymentMode) newErrors.paymentMode = 'Payment mode is required'

    const payload = {
      id: transaction?.id,
      type: form.type,
      amount: parseINRString(form.amount),
      categoryId: form.categoryId,
      date: form.date,
      paymentMode: form.paymentMode,
      note: form.note.trim(),
      isRecurring: form.isRecurring,
      recurrence: form.isRecurring ? form.recurrence : undefined,
    }
    const validation = transactionSchema.safeParse(payload)
    if (!validation.success) {
      validation.error.issues.forEach(issue => {
        newErrors[issue.path[0]] = issue.message
      })
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    // Keep the form open until the save succeeds so failures are not lost.
    setSaving(true)
    setSubmitError('')
    try {
      await onSave(payload)
      onClose()
    } catch (err) {
      const fieldErrors = err?.fields || {}
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
      setSubmitError(err?.message || 'Could not save the transaction. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transaction ? 'Edit Transaction' : 'Add Transaction'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {submitError && <ErrorAlert message={submitError} />}
        <div className="flex gap-2">
          {TRANSACTION_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              aria-pressed={form.type === t.value}
              onClick={() => handleTypeChange(t.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors font-medium text-sm',
                form.type === t.value
                  ? t.value === 'income'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
              )}
            >
              <Plus size={18} />
              {t.label}
            </button>
          ))}
        </div>

        <Input
          label="Amount (₹)"
          value={form.amount}
          onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
          prefix="₹"
          error={errors.amount}
          placeholder="0.00"
        />

        <Select
          label="Category"
          options={categories.map(c => ({ value: c.id, label: c.name }))}
          value={form.categoryId}
          onChange={v => setForm(prev => ({ ...prev, categoryId: v }))}
          placeholder="Select category"
          error={errors.categoryId}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date"
            type="datetime-local"
            value={form.date}
            onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
            error={errors.date}
          />

          <Select
            label="Payment Mode"
            options={[
              { value: 'upi', label: 'UPI' },
              { value: 'card', label: 'Card' },
              { value: 'bank_transfer', label: 'Bank transfer' },
              { value: 'cash', label: 'Cash' },
              { value: 'other', label: 'Other' },
            ]}
            value={form.paymentMode}
            onChange={v => setForm(prev => ({ ...prev, paymentMode: v }))}
            error={errors.paymentMode}
          />
        </div>

        <Input
          label="Notes (optional)"
          value={form.note}
          onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
          placeholder="e.g. Grocery shopping, team lunch"
          maxLength={500}
          error={errors.note}
        />

        <div className="flex items-center gap-3 pt-2">
          <input
            id="is-recurring"
            type="checkbox"
            checked={form.isRecurring}
            onChange={e => setForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
            className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface-container-lowest"
          />
          <label htmlFor="is-recurring" className="text-label-sm text-label-sm text-on-surface cursor-pointer">
            Recurring transaction
          </label>
        </div>

        {form.isRecurring && (
          <div className="bg-surface-container-low rounded-lg p-3 border border-outline/30">
            <Select
              label="Frequency"
              options={RECURRENCE_FREQUENCIES.map(f => ({ value: f.value, label: f.label }))}
              value={form.recurrence.frequency}
              onChange={v => setForm(prev => ({ ...prev, recurrence: { ...prev.recurrence, frequency: v } }))}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={saving}
          >
            Save Transaction
          </Button>
        </div>
      </form>
    </Modal>
  )
}