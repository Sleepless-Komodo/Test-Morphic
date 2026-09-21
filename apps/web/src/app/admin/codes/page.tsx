import { desc } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { generateRedeemCodes, toggleRedeemCode } from '@/lib/admin-actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { formatCredits } from '@/lib/utils';
import { Ticket, Plus } from 'lucide-react';

export default async function AdminCodes() {
  await requireAdmin();
  const { t } = await getServerTranslation();

  const [codes, models] = await Promise.all([
    db.select().from(s.redeemCodes).orderBy(desc(s.redeemCodes.createdAt)).limit(100),
    db.select({ id: s.models.id, displayName: s.models.displayName }).from(s.models),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-5 border-b border-neutral-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-neutral-950 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-neutral-700" />
            {t.admin.codes.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            {t.admin.codes.desc} ({codes.length} {t.admin.codes.recentVouchers}).
          </p>
        </div>
      </div>

      {/* Generate Codes Card */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100">
          <Plus className="w-4 h-4 text-neutral-700" />
          <h2 className="text-sm font-heading font-bold text-neutral-950">{t.admin.codes.generateTitle}</h2>
        </div>
        <form action={generateRedeemCodes} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label htmlFor="code-prefix" className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              {t.admin.codes.prefixLabel}
            </label>
            <input
              id="code-prefix"
              name="prefix"
              aria-label={t.admin.codes.prefixLabel}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 font-mono uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              placeholder="MORPHIC-HACK"
              required
            />
          </div>

          <div>
            <label htmlFor="code-count" className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              {t.admin.codes.countLabel}
            </label>
            <input
              id="code-count"
              name="count"
              aria-label={t.admin.codes.countLabel}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              type="number"
              min={1}
              max={500}
              defaultValue={1}
            />
          </div>

          <div>
            <label htmlFor="code-type" className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              {t.admin.codes.rewardTypeLabel}
            </label>
            <select
              id="code-type"
              name="rewardType"
              aria-label={t.admin.codes.rewardTypeLabel}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              <option value="credits">{t.admin.codes.creditsReward}</option>
              <option value="package">{t.admin.codes.packageReward}</option>
            </select>
          </div>

          <div>
            <label htmlFor="code-credits" className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              {t.admin.codes.creditAmountLabel}
            </label>
            <input
              id="code-credits"
              name="creditAmount"
              aria-label={t.admin.codes.creditAmountLabel}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              type="number"
              defaultValue={100000}
            />
          </div>

          <div>
            <label htmlFor="code-model" className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              {t.admin.codes.modelRestrictionLabel}
            </label>
            <select
              id="code-model"
              name="modelId"
              aria-label={t.admin.codes.modelRestrictionLabel}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              <option value="">{t.admin.codes.noModelRestriction}</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="code-duration" className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              {t.admin.codes.durationHoursLabel}
            </label>
            <input
              id="code-duration"
              name="durationHours"
              aria-label={t.admin.codes.durationHoursLabel}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              type="number"
              placeholder="e.g. 24"
            />
          </div>

          <div>
            <label htmlFor="code-max-redemptions" className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              {t.admin.codes.maxRedemptionsLabel}
            </label>
            <input
              id="code-max-redemptions"
              name="maxRedemptions"
              aria-label={t.admin.codes.maxRedemptionsLabel}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              type="number"
              placeholder="e.g. 100"
            />
          </div>

          <div>
            <label htmlFor="code-expires" className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              {t.admin.codes.expiresAtLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="code-expires"
                name="expiresAt"
                aria-label={t.admin.codes.expiresAtLabel}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                type="date"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 cursor-pointer shadow-xs whitespace-nowrap"
              >
                {t.admin.codes.generateBtn}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Codes Table Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
        {codes.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">{t.admin.codes.noCodes}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/50">
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-4">{t.admin.codes.thCode}</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">{t.admin.codes.thReward}</th>
                  <th className="text-right font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">{t.admin.codes.thRedeemed}</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">{t.admin.codes.thExpires}</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">{t.admin.codes.thStatus}</th>
                  <th className="text-right font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-4">{t.admin.codes.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {codes.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-neutral-950">{c.code}</td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-neutral-900">
                        {c.rewardType === 'credits'
                          ? `${formatCredits(c.creditAmount ?? 0)} ${t.admin.codes.creditsReward}`
                          : `${formatCredits(c.creditAmount ?? 0)} cr · ${c.durationHours ?? 24}h`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-neutral-700">
                      {c.redeemedCount}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-500 text-[11px]">
                      {c.expiresAt ? c.expiresAt.toLocaleDateString() : t.admin.codes.neverExpires}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-700">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.active ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                        {c.active ? t.admin.status.active : t.admin.status.disabled}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <form action={toggleRedeemCode} className="inline-block">
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 cursor-pointer shadow-2xs"
                        >
                          {c.active ? t.admin.codes.disableBtn : t.admin.codes.enableBtn}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

