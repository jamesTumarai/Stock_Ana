/**
 * Macroeconomic Assumptions & System-wide Valuation Constants
 * Single Source of Truth for long-run economic anchors.
 *
 * In accordance with financial valuation principles (Aswath Damodaran, McKinsey):
 * The Terminal Growth Rate (g) represents the rate at which the company is expected
 * to grow into perpetuity once it reaches a mature steady state.
 *
 * CRITICAL PRINCIPLE:
 * Because no company can grow faster than the economy it operates in forever,
 * the Terminal Growth Rate CANNOT exceed the long-term sustainable growth rate
 * of the global/domestic economy (Risk-Free Rate / Long-run GDP Growth ~2.0% - 3.0%).
 *
 * Unlike WACC (which updates dynamically based on daily stock price, Beta, and bond yields),
 * Terminal Growth is a system-wide macroeconomic constant that must remain stable.
 */

export const MACRO_TERMINAL_GROWTH_DEFAULT_PCT = 3.0; // 3.0% standard long-term GDP pace
export const MACRO_TERMINAL_GROWTH_MAX_CAP_PCT = 3.0; // Hard cap for DCF models
export const MACRO_TERMINAL_GROWTH_MIN_PCT = 1.0;     // Lower bound for simulation
