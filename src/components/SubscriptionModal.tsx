import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Crown,
  Check,
  Zap,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Layers,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  type SubscriptionTierId,
  SUBSCRIPTION_TIERS,
  getTierDefinition,
} from '../domain/subscriptionTiers';
import { getStoredUserUsage } from '../services/subscriptionService';
import { evaluateAnalysisQuota } from '../utils/entitlementEngine';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isThai: boolean;
  activeTier: SubscriptionTierId;
  onSelectTier: (tier: SubscriptionTierId) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  isThai,
  activeTier,
  onSelectTier,
}) => {
  if (!isOpen) return null;

  const usage = getStoredUserUsage();
  const quota = evaluateAnalysisQuota(activeTier, usage, isThai);
  const activeDef = getTierDefinition(activeTier);

  const tierKeys: SubscriptionTierId[] = ['free', 'pro', 'institutional'];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-4xl w-full overflow-hidden my-8"
        >
          {/* Header */}
          <div className="bg-[#0b5a4b] text-white px-6 py-5 flex items-center justify-between border-b border-[#084539]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30">
                <Crown className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                  {isThai ? 'แพ็กเกจการใช้งาน & โควตาการวิเคราะห์' : 'Subscription & Quota Governance'}
                </h3>
                <p className="text-xs text-emerald-100/80 font-mono">
                  {isThai
                    ? `แพ็กเกจปัจจุบัน: ${activeDef.name.th}`
                    : `Active Plan: ${activeDef.name.en}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/40 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Active Quota Usage Status Banner */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-600 font-mono">
                    {isThai ? 'การใช้งานรอบเดือนนี้' : 'Current Monthly Usage'}
                  </span>
                  <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full font-mono font-bold">
                    {usage.billingCycleMonth}
                  </span>
                </div>
                <div className="text-sm font-semibold text-stone-800">
                  {Number.isFinite(quota.limit) ? (
                    <span>
                      {isThai
                        ? `ใช้ไปแล้ว ${quota.currentUsage} จาก ${quota.limit} รายงาน (คงเหลือ ${quota.remaining})`
                        : `${quota.currentUsage} of ${quota.limit} analyses used (${quota.remaining} remaining)`}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">
                      {isThai ? 'ไม่จำกัดจำนวนครั้ง (Unlimited)' : 'Unlimited Monthly Analyses'}
                    </span>
                  )}
                </div>
              </div>

              {Number.isFinite(quota.limit) && (
                <div className="w-full md:w-48 flex flex-col gap-1">
                  <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        quota.remaining === 0
                          ? 'bg-rose-500'
                          : quota.remaining <= 1
                          ? 'bg-amber-500'
                          : 'bg-[#0b5a4b]'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((quota.currentUsage / quota.limit) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-stone-600 flex justify-between font-mono">
                    <span>{Math.round((quota.currentUsage / quota.limit) * 100)}%</span>
                    <span>{isThai ? `รีเซ็ต ${quota.resetDate}` : `Resets ${quota.resetDate}`}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3 Tier Pricing & Feature Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tierKeys.map(tierId => {
                const tier = SUBSCRIPTION_TIERS[tierId];
                const isActive = activeTier === tierId;

                return (
                  <div
                    key={tierId}
                    className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
                      isActive
                        ? 'border-[#0b5a4b] bg-emerald-50/20 shadow-md ring-2 ring-[#0b5a4b]/20'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-stone-900 font-['Prompt','Mitr',sans-serif]">
                          {isThai ? tier.name.th : tier.name.en}
                        </h4>
                        {isActive && (
                          <span className="text-[10px] bg-[#0b5a4b] text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {isThai ? 'ใช้งานอยู่' : 'Active'}
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="text-2xl font-bold font-mono text-stone-900">
                          {tier.priceMonthlyUsd === 0 ? (
                            isThai ? 'ฟรี' : 'Free'
                          ) : (
                            <span>
                              ${tier.priceMonthlyUsd}
                              <span className="text-xs text-stone-600 font-normal"> /mo</span>
                            </span>
                          )}
                        </div>
                        {tier.priceMonthlyThb > 0 && (
                          <div className="text-xs text-stone-600 font-mono">
                            ~฿{tier.priceMonthlyThb.toLocaleString()} / {isThai ? 'เดือน' : 'mo'}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-stone-600 mb-4 min-h-[32px]">
                        {isThai ? tier.tagline.th : tier.tagline.en}
                      </p>

                      {/* Feature Bullet Points */}
                      <ul className="space-y-2 mb-6 text-xs text-stone-700">
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {Number.isFinite(tier.monthlyAnalysisQuota)
                              ? isThai
                                ? `วิเคราะห์ ${tier.monthlyAnalysisQuota} ครั้ง/เดือน`
                                : `${tier.monthlyAnalysisQuota} analyses / month`
                              : isThai
                              ? 'วิเคราะห์ได้ไม่จำกัด (Unlimited)'
                              : 'Unlimited analyses'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {Number.isFinite(tier.maxHoldings)
                              ? isThai
                                ? `บันทึกหุ้นในพอร์ต ${tier.maxHoldings} ตัว`
                                : `${tier.maxHoldings} portfolio holdings`
                              : isThai
                              ? 'พอร์ตโฟลิโอไม่จำกัด'
                              : 'Unlimited holdings'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {Number.isFinite(tier.maxAlerts)
                              ? isThai
                                ? `การแจ้งเตือน ${tier.maxAlerts} รายการ`
                                : `${tier.maxAlerts} price/filing alerts`
                              : isThai
                              ? 'การแจ้งเตือนไม่จำกัด'
                              : 'Unlimited alerts'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          {tier.features.deep_think ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                          )}
                          <span className={tier.features.deep_think ? '' : 'text-stone-400'}>
                            {isThai ? '10/10 Deep Think Validation' : '10/10 Deep Think Validation'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          {tier.features.multi_scenario_matrix ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                          )}
                          <span className={tier.features.multi_scenario_matrix ? '' : 'text-stone-400'}>
                            {isThai ? '2D Sensitivity Matrix (5x5)' : '2D Sensitivity Matrix (5x5)'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          {tier.features.custom_wacc_templates ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                          )}
                          <span className={tier.features.custom_wacc_templates ? '' : 'text-stone-400'}>
                            {isThai ? 'Institutional WACC Hurdles' : 'Institutional WACC Hurdles'}
                          </span>
                        </li>
                      </ul>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => onSelectTier(tierId)}
                      disabled={isActive}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        isActive
                          ? 'bg-stone-100 text-stone-400 cursor-default'
                          : tierId === 'pro'
                          ? 'bg-[#0b5a4b] text-white hover:bg-[#084539] shadow-xs'
                          : 'bg-stone-800 text-white hover:bg-stone-900'
                      }`}
                    >
                      <span>
                        {isActive
                          ? isThai
                            ? 'แผนปัจจุบันของคุณ'
                            : 'Current Plan'
                          : isThai
                          ? `เลือกแผน ${tier.name.th}`
                          : `Select ${tier.name.en}`}
                      </span>
                      {!isActive && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Strict Financial Integrity Invariant Footer */}
            <div className="bg-emerald-50/40 border border-emerald-200/60 rounded-xl p-3.5 flex items-start gap-3 text-xs text-stone-700">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#0b5a4b]">
                  {isThai ? 'หลักการความเที่ยงตรงทางการเงิน:' : 'Financial Integrity Guarantee:'}
                </span>{' '}
                {isThai
                  ? 'ระบบจำกัดโควตาและแพ็กเกจสมาชิกจะแยกขาดจากระบบคำนวณทางการเงินโดยสิ้นเชิง ข้อมูลรายงานจริงจาก SEC, สูตรคำนวณ DCF, Reverse DCF, และความถูกต้องของตัวเลขจะคงมาตรฐานเดียวกัน 100% ไม่ว่าผู้ใช้จะอยู่ในระดับแพ็กเกจใด'
                  : 'Entitlements and quotas operate strictly at the access boundary and never alter underlying financial calculations. Verified SEC facts, DCF formulas, Reverse DCF feasibility, and mathematical integrity remain 100% consistent across all subscription tiers.'}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
