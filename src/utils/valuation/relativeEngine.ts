import { RelativeOnlyModel, ReportData } from '../../types';

const isFinitePositive = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

/**
 * Returns a relative valuation only when the report contains a complete sourced
 * peer model. It never creates sample peers, default multiples, or price targets.
 */
export function calculateRelativeOnlyModel(data?: Partial<ReportData>): RelativeOnlyModel | undefined {
  const model = data?.intrinsic_value?.relative_only_model;
  if (!model) return undefined;

  const peers = model.peers_evaluated?.filter(peer => (
    Boolean(peer.ticker)
    && !/^PEER_\d+$/i.test(peer.ticker)
    && isFinitePositive(peer.market_cap_b)
    && isFinitePositive(peer.ev_revenue_multiple)
  )) ?? [];

  const isComplete = (
    Boolean(model.primary_metric)
    && isFinitePositive(model.peer_median_multiple)
    && isFinitePositive(model.applied_company_metric_value)
    && isFinitePositive(model.implied_enterprise_value_b)
    && isFinitePositive(model.implied_equity_value_b)
    && isFinitePositive(model.fair_value_per_share)
    && peers.length > 0
  );

  if (!isComplete || peers.length !== model.peers_evaluated.length) return undefined;
  return { ...model, peers_evaluated: peers };
}
