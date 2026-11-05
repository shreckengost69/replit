import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowLeft, ArrowUpDown, BadgeCheck, Building2, Check, ChevronRight,
  CircleAlert, ClipboardList, Compass, FilePlus2, Globe2, LoaderCircle, MapPin,
  Package, Pencil, Plus, Search, SlidersHorizontal, Trash2, UsersRound, X,
} from 'lucide-react';
import {
  getGetSupplierQueryKey,
  getGetSupplierSummaryQueryKey,
  getListSuppliersQueryKey,
  useCreateSupplier,
  useDeleteSupplier,
  useGetSupplier,
  useGetSupplierSummary,
  useListSuppliers,
  useUpdateSupplier,
} from '@workspace/api-client-react';
import type { Supplier, SupplierInput, SupplierSummary, SupplierUpdate } from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, refetchOnWindowFocus: true, retry: 1 } },
});

const fieldList = [
  { name: 'supplierId', label: 'Supplier ID', placeholder: 'e.g. SUP-1042', required: true },
  { name: 'supplierName', label: 'Supplier name', placeholder: 'Company or trading name', required: true },
  { name: 'address', label: 'Street address', placeholder: 'Street and number', required: true },
  { name: 'city', label: 'City', placeholder: 'City', required: true },
  { name: 'state', label: 'State / region', placeholder: 'State or region', required: true },
  { name: 'zipCode', label: 'Postal code', placeholder: 'Postal code', required: true },
  { name: 'country', label: 'Country', placeholder: 'Country', required: true },
  { name: 'paymentTerms', label: 'Payment terms', placeholder: 'e.g. Net 30', required: true },
] as const;

type SupplierFormValues = Omit<Supplier, never>;
type ModalProps = {
  open: boolean;
  supplier?: Supplier;
  onClose: () => void;
  onSubmit: (values: SupplierFormValues) => void;
  busy: boolean;
  error?: string;
};

function SupplierModal({ open, supplier, onClose, onSubmit, busy, error }: ModalProps) {
  const [values, setValues] = useState<SupplierFormValues>(() => supplier ?? {
    supplierId: '', supplierName: '', address: '', city: '', state: '', zipCode: '', country: '', paymentTerms: '',
  });
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (!open) return;
    setValues(supplier ?? { supplierId: '', supplierName: '', address: '', city: '', state: '', zipCode: '', country: '', paymentTerms: '' });
    setFormError('');
  }, [open, supplier]);
  if (!open) return null;
  const update = (name: keyof Supplier, value: string) => setValues((current) => ({ ...current, [name]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missing = fieldList.find((field) => !String(values[field.name]).trim());
    if (missing) {
      setFormError(`Please enter ${missing.label.toLowerCase()}.`);
      return;
    }
    setFormError('');
    onSubmit(values);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#172b31]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="page-enter max-h-[94dvh] w-full overflow-y-auto rounded-t-[22px] border border-border bg-card shadow-2xl sm:max-w-[680px] sm:rounded-[22px]" role="dialog" aria-modal="true" aria-labelledby="supplier-modal-title">
        <header className="flex items-start justify-between border-b border-border px-6 py-5 sm:px-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">{supplier ? 'Supplier record' : 'New record'}</p>
            <h2 id="supplier-modal-title" className="mt-1 font-display text-[25px] font-bold tracking-[-.04em]">{supplier ? 'Edit supplier' : 'Add a supplier'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Keep the details your team relies on current.</p>
          </div>
          <button type="button" aria-label="Close form" data-testid="button-close-supplier-form" onClick={onClose} className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            {fieldList.map((field) => (
              <label key={field.name} className={`block ${field.name === 'address' || field.name === 'supplierName' ? 'sm:col-span-2' : ''}`}>
                <span className="mb-1.5 block text-[12px] font-semibold text-foreground/80">{field.label}</span>
                <input
                  data-testid={`input-supplier-${field.name}`}
                  required={field.required}
                  disabled={busy || (Boolean(supplier) && field.name === 'supplierId')}
                  value={values[field.name]}
                  onChange={(event) => update(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/65 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                />
              </label>
            ))}
          </div>
          {(formError || error) && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-destructive"><CircleAlert size={15} />{formError || error}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-lg px-5 text-sm font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50">Cancel</button>
            <button data-testid="button-save-supplier" type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-60">
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
              {supplier ? 'Save changes' : 'Create supplier'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#20363f] text-[#f3f0e8]">
        <div className="mx-auto flex h-[66px] max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" data-testid="link-brand-home" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#385d56] text-[#e8d59e]">
              <Compass size={19} strokeWidth={1.8} />
            </div>
            <div>
              <span className="block font-display text-[17px] font-extrabold leading-none tracking-[-.04em]">Supplier Hub</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[.17em] text-[#bac6c2]">Procurement desk</span>
            </div>
          </Link>
          <div className="hidden items-center gap-2 text-[11px] font-medium tracking-wide text-[#c6d1cd] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b4d5b0]" />
            SUPPLIER OPERATIONS
          </div>
          <div className="flex items-center gap-3">
            <Link href="/purchase-entry" data-testid="link-purchase-entry" className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/[.06] px-3 text-[11px] font-semibold text-[#f3f0e8] transition hover:bg-white/[.12]">
              <FilePlus2 size={14} /> <span className="hidden sm:inline">Purchase entry</span><span className="sm:hidden">Entry</span>
            </Link>
            <span className="hidden font-mono text-[10px] tracking-wide text-[#b6c3bf] sm:block">INTERNAL</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1480px] px-5 pb-16 pt-8 sm:px-8 sm:pt-10 lg:px-12">{children}</main>
      <footer className="border-t border-border/80 px-5 py-5 text-center font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground/70">
        Supplier operations · A shared source of truth
      </footer>
    </div>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

function SummaryStrip({ summary, loading, error }: { summary?: SupplierSummary; loading: boolean; error: boolean }) {
  const highestTerm = summary?.paymentTerms.reduce((best, item) => item.count > (best?.count ?? -1) ? item : best, undefined as SupplierSummary['paymentTerms'][number] | undefined);
  const stats = [
    { label: 'Suppliers in network', value: summary?.totalSuppliers, note: 'Active records', icon: Building2 },
    { label: 'Cities covered', value: summary?.cityCount, note: 'Distinct locations', icon: MapPin },
    { label: 'Countries reached', value: summary?.countryCount, note: 'Across your footprint', icon: Globe2 },
  ];
  return (
    <section className="grid gap-3 md:grid-cols-[1.25fr_.85fr_.85fr_1fr]">
      {stats.map((stat, index) => (
        <article key={stat.label} className={`rise-in relative overflow-hidden rounded-xl border border-border bg-card px-5 py-5 ${index === 0 ? 'md:pl-6' : ''}`} style={{ animationDelay: `${index * 65}ms` }}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted-foreground">{stat.label}</span>
            <stat.icon size={16} strokeWidth={1.8} className="text-primary/80" />
          </div>
          {loading ? <SkeletonBlock className="mt-4 h-9 w-20" /> : error ? <span className="mt-2 block text-sm text-destructive">Unavailable</span> : <p className="mt-1 font-display text-[34px] font-bold leading-none tracking-[-.055em]" data-testid={`value-${stat.label.toLowerCase().replaceAll(' ', '-')}`}>{stat.value ?? '—'}</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">{stat.note}</p>
          {index === 0 && <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-primary" />}
        </article>
      ))}
      <article className="rise-in rounded-xl border border-[#d8c8a2] bg-[#f2ead8] px-5 py-5 text-[#37494a]" style={{ animationDelay: '195ms' }}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#63716c]">Most common terms</span>
          <SlidersHorizontal size={16} className="text-[#8b7853]" />
        </div>
        {loading ? <SkeletonBlock className="mt-4 h-9 w-24" /> : error ? <span className="mt-2 block text-sm text-destructive">Unavailable</span> : (
          <>
            <p className="mt-1 font-display text-[27px] font-bold leading-none tracking-[-.045em]">{highestTerm?.label ?? '—'}</p>
            <p className="mt-2 text-[11px] text-[#738078]">{highestTerm ? `${highestTerm.count} supplier${highestTerm.count === 1 ? '' : 's'} use these terms` : 'Payment terms summary'}</p>
          </>
        )}
      </article>
    </section>
  );
}

function Home() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [terms, setTerms] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(terms ? { paymentTerms: terms } : {}),
    sortBy: 'supplierName' as const,
    sortOrder,
  }), [search, city, state, terms, sortOrder]);
  const listQuery = useListSuppliers(params);
  const optionsQuery = useListSuppliers({ sortBy: 'city', sortOrder: 'asc' });
  const summaryQuery = useGetSupplierSummary();
  const createMutation = useCreateSupplier();
  const suppliers = listQuery.data ?? [];
  const summary = summaryQuery.data;
  const allSuppliers = optionsQuery.data ?? [];
  const cities = [...new Set(allSuppliers.map((supplier) => supplier.city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const states = [...new Set(allSuppliers.map((supplier) => supplier.state).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const paymentOptions = summary?.paymentTerms?.map((item) => item.label) ?? [];
  const resetFilters = () => { setSearch(''); setCity(''); setState(''); setTerms(''); };
  const invalidateDirectory = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getListSuppliersQueryKey() }),
      client.invalidateQueries({ queryKey: getGetSupplierSummaryQueryKey() }),
    ]);
  };
  const createSupplier = (values: SupplierFormValues) => {
    setCreateError('');
    const input: SupplierInput = values;
    createMutation.mutate({ data: input }, {
      onSuccess: async () => { await invalidateDirectory(); setModalOpen(false); },
      onError: (error) => setCreateError(error instanceof Error ? error.message : 'Could not create this supplier. Try again.'),
    });
  };
  const loading = listQuery.isLoading;
  const filtered = Boolean(search || city || state || terms);
  return (
    <AppFrame>
      <div className="page-enter">
        <div className="mb-7 flex flex-col gap-5 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary">
              <span className="h-px w-7 bg-primary/60" /> Supplier directory
            </div>
            <h1 className="font-display text-[34px] font-bold leading-[1.04] tracking-[-.055em] sm:text-[43px]">Know who you rely on.</h1>
            <p className="mt-2 max-w-[560px] text-[14px] leading-6 text-muted-foreground">A current view of your supplier network, locations, and the terms behind every relationship.</p>
          </div>
          <button data-testid="button-add-supplier" onClick={() => { setCreateError(''); setModalOpen(true); }} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:brightness-105">
            <Plus size={17} /> Add supplier
          </button>
        </div>

        <SummaryStrip summary={summary} loading={summaryQuery.isLoading} error={summaryQuery.isError} />

        <section className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-[19px] font-bold tracking-[-.035em]">Supplier records</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">{listQuery.isFetching && !loading ? 'Refreshing current records…' : `${listQuery.data?.length ?? 0} ${listQuery.data?.length === 1 ? 'record' : 'records'} shown`}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="relative block min-w-0 sm:min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input data-testid="input-search-suppliers" aria-label="Search suppliers" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search suppliers" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-[12px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
              <select data-testid="select-filter-city" aria-label="Filter by city" value={city} onChange={(event) => setCity(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary">
                <option value="">All cities</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select data-testid="select-filter-state" aria-label="Filter by state" value={state} onChange={(event) => setState(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary">
                <option value="">All regions</option>{states.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select data-testid="select-filter-terms" aria-label="Filter by payment terms" value={terms} onChange={(event) => setTerms(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary">
                <option value="">All terms</option>{paymentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button data-testid="button-sort-suppliers" onClick={() => setSortOrder((order) => order === 'asc' ? 'desc' : 'asc')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 text-[12px] font-medium transition hover:bg-muted" aria-label={`Sort supplier names ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}>
                <ArrowUpDown size={14} /> Name <span className="font-mono text-[10px] text-muted-foreground">{sortOrder === 'asc' ? 'A–Z' : 'Z–A'}</span>
              </button>
            </div>
          </div>

          {listQuery.isError && (
            <div role="alert" className="m-5 flex flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-5 sm:flex-row sm:items-center">
              <CircleAlert size={19} className="text-destructive" />
              <div className="flex-1"><p className="text-sm font-semibold">Supplier records couldn’t be loaded</p><p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p></div>
              <button data-testid="button-retry-suppliers" onClick={() => listQuery.refetch()} className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Retry</button>
            </div>
          )}
          {summaryQuery.isError && <div className="mx-5 mt-4 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive"><span>Supplier overview couldn’t refresh.</span><button onClick={() => summaryQuery.refetch()} className="font-semibold underline underline-offset-2">Retry</button></div>}

          {loading ? (
            <div className="space-y-3 p-5 sm:p-6" aria-label="Loading suppliers">
              {[0, 1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4 rounded-lg border border-border/70 p-4"><SkeletonBlock className="h-10 w-10 rounded-full" /><div className="flex-1"><SkeletonBlock className="h-4 w-44" /><SkeletonBlock className="mt-2 h-3 w-60 max-w-full" /></div><SkeletonBlock className="hidden h-5 w-24 sm:block" /></div>)}
            </div>
          ) : !listQuery.isError && suppliers.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center sm:py-[72px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e4ede7] text-primary"><UsersRound size={24} strokeWidth={1.7} /></div>
              <h3 className="mt-4 font-display text-[20px] font-bold tracking-[-.03em]">{filtered ? 'No records match those filters' : 'Your directory starts here'}</h3>
              <p className="mt-2 max-w-[350px] text-[13px] leading-5 text-muted-foreground">{filtered ? 'Try another search or clear a filter to see more suppliers.' : 'Add the first supplier your team relies on to create a shared, current record.'}</p>
              {filtered ? <button data-testid="button-clear-filters" onClick={resetFilters} className="mt-5 rounded-lg border border-border px-4 py-2.5 text-xs font-semibold hover:bg-muted">Clear filters</button> : <button onClick={() => setModalOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Plus size={15} /> Add first supplier</button>}
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(220px,1.55fr)_minmax(150px,1fr)_minmax(160px,1.1fr)_minmax(115px,.75fr)_auto] items-center gap-4 bg-[#f3f0e8]/70 px-6 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground md:grid">
                <span>Supplier</span><span>Location</span><span>Address</span><span>Payment terms</span><span className="w-6" />
              </div>
              <div className="divide-y divide-border/80">
                {suppliers.map((supplier, index) => (
                  <Link href={`/suppliers/${encodeURIComponent(supplier.supplierId)}`} key={supplier.supplierId} data-testid={`link-supplier-${supplier.supplierId}`} className="group grid gap-3 px-5 py-4 transition hover:bg-[#f6f3eb] sm:px-6 md:grid-cols-[minmax(220px,1.55fr)_minmax(150px,1fr)_minmax(160px,1.1fr)_minmax(115px,.75fr)_auto] md:items-center md:gap-4" style={{ animationDelay: `${index * 22}ms` }}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d5e1d8] bg-[#e9f0ea] font-display text-[13px] font-bold text-primary">{supplier.supplierName.slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold tracking-[-.01em] group-hover:text-primary">{supplier.supplierName}</span>
                        <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{supplier.supplierId}</span>
                      </span>
                    </div>
                    <span className="flex items-center gap-2 pl-[52px] text-[12px] text-foreground/80 md:pl-0"><MapPin size={13} className="shrink-0 text-muted-foreground" />{[supplier.city, supplier.state].filter(Boolean).join(', ')}</span>
                    <span className="truncate pl-[52px] text-[12px] text-muted-foreground md:pl-0">{supplier.address}, {supplier.zipCode}</span>
                    <span className="flex items-center gap-2 pl-[52px] md:pl-0"><span className="rounded-md bg-[#f1eadb] px-2.5 py-1.5 font-mono text-[10px] text-[#735f38]">{supplier.paymentTerms}</span></span>
                    <span className="hidden justify-end text-muted-foreground md:flex"><ChevronRight size={17} className="transition group-hover:translate-x-0.5 group-hover:text-primary" /></span>
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-border bg-[#f7f4ed]/55 px-5 py-3 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span>Showing {suppliers.length} supplier{suppliers.length === 1 ? '' : 's'}{filtered ? ' for current filters' : ''}</span>
                <span className="font-mono text-[9px] uppercase tracking-[.12em]">Live from supplier records</span>
              </div>
            </>
          )}
        </section>
      </div>
      <SupplierModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={createSupplier} busy={createMutation.isPending} error={createError} />
    </AppFrame>
  );
}

function Detail() {
  const { supplierId = '' } = useParams<{ supplierId: string }>();
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const id = decodeURIComponent(supplierId);
  const query = useGetSupplier(id);
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const supplier = query.data;
  const invalidate = async () => Promise.all([
    client.invalidateQueries({ queryKey: getListSuppliersQueryKey() }),
    client.invalidateQueries({ queryKey: getGetSupplierSummaryQueryKey() }),
  ]);
  const updateSupplier = (values: SupplierFormValues) => {
    if (!supplier) return;
    setEditError('');
    const { supplierId: _supplierId, ...data }: SupplierFormValues = values;
    const update: SupplierUpdate = data;
    updateMutation.mutate({ supplierId: id, data: update }, {
      onSuccess: async (updated) => {
        client.setQueryData(getGetSupplierQueryKey(id), updated);
        await invalidate();
        setEditOpen(false);
      },
      onError: (error) => setEditError(error instanceof Error ? error.message : 'Could not save changes. Try again.'),
    });
  };
  const removeSupplier = () => {
    if (!supplier || deleteMutation.isPending) return;
    const confirmed = window.confirm(`Delete ${supplier.supplierName} (${supplier.supplierId})? This cannot be undone.`);
    if (!confirmed) return;
    setDeleteError('');
    deleteMutation.mutate({ supplierId: id }, {
      onSuccess: async () => {
        await invalidate();
        setLocation('/');
      },
      onError: (error) => setDeleteError(error instanceof Error ? error.message : 'Could not delete this supplier. Try again.'),
    });
  };
  if (query.isLoading) {
    return <AppFrame><div className="page-enter"><SkeletonBlock className="mb-7 h-4 w-36" /><SkeletonBlock className="h-12 w-72 max-w-full" /><SkeletonBlock className="mt-3 h-4 w-56" /><div className="mt-9 grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((item) => <SkeletonBlock key={item} className="h-28" />)}</div></div></AppFrame>;
  }
  if (query.isError || !supplier) {
    return <AppFrame><div className="mx-auto max-w-[620px] rounded-2xl border border-border bg-card px-6 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><CircleAlert size={21} /></div><h1 className="mt-4 font-display text-2xl font-bold tracking-[-.04em]">{query.isError ? 'Record unavailable' : 'Supplier not found'}</h1><p className="mt-2 text-sm text-muted-foreground">{query.isError ? 'We couldn’t load this supplier. Try again, or return to the directory.' : 'This supplier may have been removed or the link may be incorrect.'}</p><div className="mt-6 flex justify-center gap-3">{query.isError && <button onClick={() => query.refetch()} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Try again</button>}<Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><ArrowLeft size={15} /> Back to directory</Link></div></div></AppFrame>;
  }
  const location = [supplier.city, supplier.state, supplier.zipCode, supplier.country].filter(Boolean).join(', ');
  const details = [
    { label: 'Supplier ID', value: supplier.supplierId, mono: true },
    { label: 'Payment terms', value: supplier.paymentTerms, highlight: true },
    { label: 'Street address', value: supplier.address },
    { label: 'City', value: supplier.city },
    { label: 'State / region', value: supplier.state },
    { label: 'Postal code', value: supplier.zipCode, mono: true },
    { label: 'Country', value: supplier.country },
  ];
  return (
    <AppFrame>
      <div className="page-enter">
        <Link href="/" data-testid="link-back-directory" className="mb-7 inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground transition hover:text-primary"><ArrowLeft size={15} /> All suppliers</Link>
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-7 sm:px-8 sm:py-9">
          <div className="absolute right-[-50px] top-[-82px] h-[240px] w-[240px] rounded-full border border-[#e7e0d0] sm:right-[-18px] sm:top-[-118px] sm:h-[320px] sm:w-[320px]" />
          <div className="absolute right-[30px] top-[-35px] h-[185px] w-[185px] rounded-full border border-[#eee9dd] sm:right-[65px] sm:top-[-62px] sm:h-[235px] sm:w-[235px]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-2xl bg-[#e8efe9] font-display text-2xl font-bold text-primary">{supplier.supplierName.slice(0, 1).toUpperCase()}</div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Supplier record</p>
                <h1 data-testid="text-supplier-name" className="mt-1 font-display text-[31px] font-bold leading-tight tracking-[-.055em] sm:text-[39px]">{supplier.supplierName}</h1>
                <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><MapPin size={14} />{location}</p>
              </div>
            </div>
            <div className="relative flex gap-2 sm:self-start">
              <button data-testid="button-edit-supplier" onClick={() => { setEditError(''); setEditOpen(true); }} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-[12px] font-semibold transition hover:bg-muted sm:flex-none"><Pencil size={14} /> Edit record</button>
              <button data-testid="button-delete-supplier" onClick={removeSupplier} disabled={deleteMutation.isPending} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#e8c8c2] bg-[#fff9f7] px-4 text-[12px] font-semibold text-[#a24a3c] transition hover:bg-[#f8e9e5] disabled:opacity-60 sm:flex-none">{deleteMutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete</button>
            </div>
          </div>
          {deleteError && <p role="alert" className="relative mt-4 rounded-lg bg-destructive/5 px-4 py-3 text-sm text-destructive">{deleteError}</p>}
        </section>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
          <section className="rounded-xl border border-border bg-card px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div><h2 className="font-display text-[18px] font-bold tracking-[-.035em]">Business details</h2><p className="mt-1 text-[12px] text-muted-foreground">Reference information for your team</p></div>
              <Building2 size={18} className="text-primary/70" />
            </div>
            <dl className="mt-2 grid gap-x-8 sm:grid-cols-2">
              {details.map((item) => <div key={item.label} className="border-b border-border/70 py-4 last:border-0"><dt className="font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground">{item.label}</dt><dd data-testid={`text-detail-${item.label.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`} className={`mt-1.5 text-[13px] font-medium ${item.mono ? 'font-mono text-[12px]' : ''} ${item.highlight ? 'inline-flex rounded-md bg-[#f1eadb] px-2.5 py-1.5 font-mono text-[12px] text-[#735f38]' : ''}`}>{item.value}</dd></div>)}
            </dl>
          </section>
          <aside className="flex flex-col gap-4">
            <section className="rounded-xl border border-[#d9e4da] bg-[#edf2eb] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2 text-primary"><Check size={16} /><span className="font-mono text-[9px] uppercase tracking-[.15em]">Relationship snapshot</span></div>
              <p className="mt-4 font-display text-[23px] font-bold leading-[1.13] tracking-[-.04em]">One record. Current details.</p>
              <p className="mt-2 text-[12px] leading-5 text-[#65756c]">The directory reflects supplier information maintained by your procurement team.</p>
            </section>
            <section className="rounded-xl border border-border bg-card px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2 text-muted-foreground"><Globe2 size={15} /><span className="font-mono text-[9px] uppercase tracking-[.15em]">Location</span></div>
              <p className="mt-3 text-[13px] font-semibold">{supplier.country}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{[supplier.city, supplier.state].filter(Boolean).join(' · ')}</p>
              <p className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">{supplier.zipCode}</p>
            </section>
          </aside>
        </div>
      </div>
      <SupplierModal open={editOpen} supplier={supplier} onClose={() => setEditOpen(false)} onSubmit={updateSupplier} busy={updateMutation.isPending} error={editError} />
    </AppFrame>
  );
}

type EntryReview = { supplierName: string; supplierId: string; paymentTerms: string; itemName: string; price: string };

function PurchaseEntry() {
  const suppliersQuery = useListSuppliers();
  const [supplierId, setSupplierId] = useState('');
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [validationError, setValidationError] = useState('');
  const [review, setReview] = useState<EntryReview | null>(null);
  const suppliers = suppliersQuery.data ?? [];
  const selectedSupplier = suppliers.find((supplier) => supplier.supplierId === supplierId);

  const submitEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError('');
    if (!selectedSupplier) {
      setValidationError('Select a supplier before reviewing this entry.');
      return;
    }
    if (!itemName.trim()) {
      setValidationError('Enter an item name.');
      return;
    }
    const amount = Number(price);
    if (!price.trim() || !Number.isFinite(amount) || amount < 0 || !/^\d+(\.\d{1,2})?$/.test(price.trim())) {
      setValidationError('Enter a nonnegative price with no more than two decimal places.');
      return;
    }
    setReview({
      supplierName: selectedSupplier.supplierName,
      supplierId: selectedSupplier.supplierId,
      paymentTerms: selectedSupplier.paymentTerms,
      itemName: itemName.trim(),
      price: amount.toFixed(2),
    });
  };

  const resetEntry = () => {
    setSupplierId('');
    setItemName('');
    setPrice('');
    setValidationError('');
    setReview(null);
  };

  return (
    <AppFrame>
      <div className="page-enter mx-auto max-w-[1040px]">
        <div className="mb-7 flex flex-col gap-5 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" data-testid="link-entry-back-directory" className="mb-6 inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground transition hover:text-primary"><ArrowLeft size={15} /> Supplier directory</Link>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary">
              <span className="h-px w-7 bg-primary/60" /> Procurement workspace / item capture
            </div>
            <h1 className="font-display text-[35px] font-bold leading-[1.04] tracking-[-.055em] sm:text-[45px]">Capture a price.</h1>
            <p className="mt-2 max-w-[560px] text-[14px] leading-6 text-muted-foreground">Choose a supplier, check their current terms, and record a single item reference.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#d9e4da] bg-[#edf2eb] px-4 py-3 text-[#3d6257]">
            <ClipboardList size={18} />
            <span><span className="block font-mono text-[9px] uppercase tracking-[.14em]">Entry mode</span><span className="mt-0.5 block text-[12px] font-semibold">Form only · not submitted</span></span>
          </div>
        </div>

        {suppliersQuery.isError && (
          <div role="alert" className="mb-5 flex flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-5 sm:flex-row sm:items-center">
            <CircleAlert size={19} className="text-destructive" />
            <div className="flex-1"><p className="text-sm font-semibold">Supplier records couldn’t be loaded</p><p className="mt-1 text-xs text-muted-foreground">The supplier list is needed to keep terms accurate.</p></div>
            <button type="button" data-testid="button-retry-entry-suppliers" onClick={() => suppliersQuery.refetch()} className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Retry</button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.75fr)]">
          <form onSubmit={submitEntry} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-5 sm:px-7">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">01 / Source</p>
              <h2 className="mt-1 font-display text-[21px] font-bold tracking-[-.04em]">Supplier and terms</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">Terms are read directly from the selected supplier record.</p>
            </div>
            <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-foreground/80">Supplier <span className="text-destructive">*</span></span>
                <select data-testid="select-entry-supplier" required disabled={suppliersQuery.isLoading || suppliersQuery.isError} value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setReview(null); setValidationError(''); }} className="h-12 w-full rounded-lg border border-input bg-background px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60">
                  <option value="">{suppliersQuery.isLoading ? 'Loading supplier records…' : suppliersQuery.isError ? 'Supplier records unavailable' : 'Select a supplier'}</option>
                  {suppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName} · {supplier.supplierId}</option>)}
                </select>
              </label>

              {suppliersQuery.isSuccess && suppliers.length === 0 && (
                <div className="rounded-lg border border-[#e4ddc9] bg-[#f7f3e9] px-4 py-3 text-[12px] leading-5 text-[#71664e]">
                  No supplier records are available yet. Add a supplier in the directory to start an item entry.
                </div>
              )}

              {selectedSupplier && (
                <div data-testid="text-entry-supplier-location" className="flex items-start gap-3 rounded-lg border border-border/80 bg-[#f7f5ee] px-4 py-3">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0"><p className="text-[12px] font-semibold">{selectedSupplier.supplierName}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{selectedSupplier.address}, {selectedSupplier.city}, {selectedSupplier.state} {selectedSupplier.zipCode}, {selectedSupplier.country}</p></div>
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between gap-2 text-[12px] font-semibold text-foreground/80">
                  Payment terms
                  <span className="font-mono text-[9px] font-normal uppercase tracking-[.1em] text-muted-foreground">Supplier record · read only</span>
                </span>
                <input data-testid="input-entry-payment-terms" aria-label="Payment terms (read only)" readOnly value={selectedSupplier?.paymentTerms ?? ''} placeholder="Select a supplier to view terms" className="h-11 w-full cursor-default rounded-lg border border-[#e4ddc9] bg-[#f5f1e6] px-3.5 font-mono text-[12px] text-[#705f3e] outline-none placeholder:font-sans placeholder:text-[12px] placeholder:text-muted-foreground/70" />
              </label>

              <div className="border-t border-border pt-5">
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">02 / Item reference</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-foreground/80">Item name <span className="text-destructive">*</span></span>
                    <input data-testid="input-entry-item-name" required maxLength={120} value={itemName} onChange={(event) => { setItemName(event.target.value); setReview(null); }} placeholder="e.g. Corrugated shipping carton" className="h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/65 focus:border-primary focus:ring-2 focus:ring-primary/15" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-foreground/80">Unit price <span className="text-destructive">*</span></span>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[13px] text-muted-foreground">$</span>
                      <input data-testid="input-entry-price" required type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value); setReview(null); }} placeholder="0.00" className="h-11 w-full rounded-lg border border-input bg-background pl-8 pr-3.5 font-mono text-[13px] outline-none transition placeholder:text-muted-foreground/65 focus:border-primary focus:ring-2 focus:ring-primary/15" />
                    </div>
                  </label>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Enter a nonnegative amount, up to two decimal places.</p>
              </div>

              {validationError && <p role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/5 px-3.5 py-3 text-[12px] text-destructive"><CircleAlert size={15} />{validationError}</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <button type="button" data-testid="button-reset-entry" onClick={resetEntry} className="h-11 rounded-lg px-5 text-sm font-semibold text-muted-foreground transition hover:bg-muted">Clear form</button>
                <button data-testid="button-review-entry" type="submit" disabled={suppliersQuery.isLoading || suppliersQuery.isError || suppliers.length === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55">
                  <Check size={16} /> Review entry
                </button>
              </div>
            </div>
          </form>

          <aside className="flex flex-col gap-4">
            <section className="relative overflow-hidden rounded-2xl border border-[#d9e4da] bg-[#edf2eb] px-5 py-6 sm:px-6">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[#d8e3d7]" />
              <div className="relative flex items-center gap-2 text-primary"><Package size={16} /><span className="font-mono text-[9px] uppercase tracking-[.15em]">Entry preview</span></div>
              {review ? (
                <div className="relative mt-5">
                  <div className="flex items-center gap-2 rounded-lg bg-[#dfe9df] px-3 py-2 text-[11px] font-semibold text-[#3d6257]"><BadgeCheck size={15} /> Ready for your records</div>
                  <h3 data-testid="text-entry-review-item" className="mt-5 font-display text-[23px] font-bold leading-tight tracking-[-.04em]">{review.itemName}</h3>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{review.supplierName} · {review.supplierId}</p>
                  <div className="mt-5 border-t border-[#d6e0d5] pt-4">
                    <div className="flex items-baseline justify-between gap-3"><span className="text-[11px] text-muted-foreground">Unit price</span><span data-testid="text-entry-review-price" className="font-mono text-[20px] font-medium text-[#344f45]">${review.price}</span></div>
                    <div className="mt-3 flex items-baseline justify-between gap-3"><span className="text-[11px] text-muted-foreground">Payment terms</span><span data-testid="text-entry-review-terms" className="text-right font-mono text-[11px] font-medium text-[#705f3e]">{review.paymentTerms}</span></div>
                  </div>
                  <p className="mt-5 text-[11px] leading-5 text-[#65756c]">This is a local review only. Nothing has been saved or submitted.</p>
                </div>
              ) : (
                <div className="relative mt-5 border-t border-[#d6e0d5] pt-5">
                  <p className="font-display text-[22px] font-bold leading-[1.12] tracking-[-.04em]">A clear reference, before the next step.</p>
                  <p className="mt-2 text-[12px] leading-5 text-[#65756c]">Your selected supplier’s terms stay attached to this preview so they’re easy to verify.</p>
                  <div className="mt-6 flex items-center gap-3 rounded-lg border border-[#d6e0d5] bg-[#f4f6f0]/80 px-3 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e2eae0] text-primary"><ClipboardList size={16} /></span>
                    <span><span className="block font-mono text-[9px] uppercase tracking-[.12em] text-[#75847b]">What you’ll review</span><span className="mt-1 block text-[11px] font-semibold text-[#43594f]">Supplier · item · price · terms</span></span>
                  </div>
                </div>
              )}
            </section>
            <section className="rounded-xl border border-border bg-card px-5 py-5">
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted-foreground">A note on accuracy</p>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">Payment terms are never typed into this form. To change them, update the supplier record in the directory.</p>
              <Link href="/" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary transition hover:gap-2.5">Open supplier directory <ChevronRight size={14} /></Link>
            </section>
          </aside>
        </div>
      </div>
    </AppFrame>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/suppliers/:supplierId" component={Detail} />
        <Route path="/purchase-entry" component={PurchaseEntry} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
