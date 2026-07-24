import clsx from 'clsx'

/**
 * Primitive dùng chung cho các màn hình quản trị. Cố tình giữ tối thiểu —
 * chỉ gom những mẫu lặp lại thật sự, không dựng design system sớm.
 */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Card({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={clsx(
        'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {title ? (
        <div className="mb-3">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950"
    >
      <h2 className="text-sm font-medium text-rose-900 dark:text-rose-200">
        Không tải được dữ liệu
      </h2>
      <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">{message}</p>
    </div>
  )
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'error'
  children: React.ReactNode
}) {
  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200',
    warning:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
    error:
      'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200',
  }[tone]

  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={clsx('rounded-md border px-3 py-2 text-sm', styles)}>
      {children}
    </div>
  )
}

const BUTTON_BASE =
  'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
} as const

export function buttonClass(
  variant: keyof typeof BUTTON_VARIANTS = 'primary',
  className?: string,
) {
  return clsx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS
}) {
  return <button className={buttonClass(variant, className)} {...props} />
}

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-blue-600 ' +
  'dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}
    </label>
  )
}
