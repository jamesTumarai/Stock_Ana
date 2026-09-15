import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_MONITORING_PREFERENCES } from '../utils/monitoringEngine';
import {
  hasMonitoringWorkspaceData,
  hasPortfolioWorkspaceData,
  parseUserWorkspace
} from './userWorkspaceService';

describe('userWorkspaceService', () => {
  it('accepts an authenticated workspace payload and normalizes tracked tickers', () => {
    const workspace = parseUserWorkspace({
      portfolioWorkspace: {
        holdings: [{ ticker: ' msft ', quantity: 2, average_cost: 400, portfolio_id: undefined }],
        watchlist: ['msft', 'NVDA', 'MSFT'],
        multiPortfolioConfig: { version: 2, portfolios: [], ticker_limits: [] }
      },
      monitoringWorkspace: {
        preferences: DEFAULT_MONITORING_PREFERENCES,
        readAlertIds: ['alert-1', 'alert-1'],
        lastSeenFilings: { msft: '0001', invalid: '' }
      }
    });

    assert.equal(workspace.portfolio?.holdings[0].ticker, 'MSFT');
    assert.deepEqual(workspace.portfolio?.watchlist, ['MSFT', 'NVDA']);
    assert.equal(workspace.portfolio?.holdings[0].portfolio_id, null);
    assert.deepEqual(workspace.monitoring?.readAlertIds, ['alert-1']);
    assert.deepEqual(workspace.monitoring?.lastSeenFilings, { MSFT: '0001' });
  });

  it('does not treat malformed cloud fields as an empty workspace that could overwrite local data', () => {
    const workspace = parseUserWorkspace({
      portfolioWorkspace: { holdings: [], watchlist: 'not-an-array' },
      monitoringWorkspace: { preferences: {}, readAlertIds: 'not-an-array' }
    });

    assert.equal(workspace.portfolio, undefined);
    assert.equal(workspace.monitoring, undefined);
  });

  it('detects local data that should be migrated once after sign-in', () => {
    assert.equal(hasPortfolioWorkspaceData({
      holdings: [],
      watchlist: ['SOFI'],
      multiPortfolioConfig: { version: 2, portfolios: [], ticker_limits: [] }
    }), true);
    assert.equal(hasMonitoringWorkspaceData({
      preferences: DEFAULT_MONITORING_PREFERENCES,
      readAlertIds: ['alert-1'],
      lastSeenFilings: {}
    }, DEFAULT_MONITORING_PREFERENCES), true);
  });
});
