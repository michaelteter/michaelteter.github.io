/**
 * Credit Card Simulator Core Engine (ccsim-core.js)
 * Pure functional calculation engine & state transition model
 * Supports both Node.js (CommonJS/ESM) and Browser environments (window.CCSim).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.CCSim = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // =========================================================================
  // 1. Constants & Configurations
  // =========================================================================

  const PRESETS = {
    laptop: {
      id: 'laptop',
      name: 'School Laptop',
      icon: '💻',
      thb: 52500,
      usd: 1500
    },
    phone: {
      id: 'phone',
      name: 'Flagship Phone',
      icon: '📱',
      thb: 35000,
      usd: 1000
    },
    console: {
      id: 'console',
      name: 'Game Console',
      icon: '🎮',
      thb: 17500,
      usd: 500
    },
    ticket: {
      id: 'ticket',
      name: 'Concert Ticket',
      icon: '🎟️',
      thb: 5250,
      usd: 150
    }
  };

  const CURRENCY_CONFIG = {
    THB: {
      symbol: '฿',
      wordSingle: 'baht',
      wordPlural: 'baht',
      minPurchase: 500,
      maxPurchase: 2000000,
      stepPurchase: 500,
      minFixed: 500,
      maxFixed: 20000,
      stepFixed: 250,
      defaultFixed: 3500,
      floorMinPayment: 500, // Bank of Thailand BOT floor
      baseBudget: 20000, // Monthly benchmark budget for youth/entry worker
      quickFixedOptions: [1500, 3500, 5000, 10000],
      oppCatalog: [
        { icon: '🧋', name: 'Thai Milk Teas', cost: 50 },
        { icon: '🍜', name: 'Bowls of Pad Thai', cost: 60 },
        { icon: '🎬', name: 'Movie Tickets', cost: 240 },
        { icon: '🎧', name: 'Months of Spotify', cost: 139 },
        { icon: '📱', name: 'AirPods (approx)', cost: 5500 }
      ]
    },
    USD: {
      symbol: '$',
      wordSingle: 'dollar',
      wordPlural: 'dollars',
      minPurchase: 10,
      maxPurchase: 50000,
      stepPurchase: 10,
      minFixed: 20,
      maxFixed: 500,
      stepFixed: 5,
      defaultFixed: 100,
      floorMinPayment: 25,
      baseBudget: 600,
      quickFixedOptions: [50, 100, 150, 250],
      oppCatalog: [
        { icon: '🧋', name: 'Boba Drinks', cost: 5.5 },
        { icon: '🍕', name: 'Large Pizzas', cost: 18 },
        { icon: '🎬', name: 'Cinema Tickets', cost: 15 },
        { icon: '🎧', name: 'Months of Spotify', cost: 11 },
        { icon: '🎮', name: 'New Video Games', cost: 70 }
      ]
    }
  };

  const STRATEGIES = ['minimum', 'fixed', 'full', 'promo'];
  const PROMO_SCENARIOS = ['ideal', 'slip11', 'slipmin'];

  // =========================================================================
  // 2. Pure Formatting Helpers
  // =========================================================================

  function formatMoney(amount, currency = 'THB') {
    if (isNaN(amount) || !isFinite(amount)) return '∞';
    if (currency === 'THB') {
      return '฿' + Math.round(amount).toLocaleString('en-US');
    }
    return '$' + Math.round(amount).toLocaleString('en-US');
  }

  function getCurrencyWord(currency = 'THB', plural = false, capitalize = false) {
    const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.THB;
    let word = plural ? config.wordPlural : config.wordSingle;
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    return word;
  }

  function formatMonths(months) {
    if (!isFinite(months) || months >= 600) return 'Never (Debt Trap!)';
    if (months === 0) return 'Immediate (0 months)';
    if (months === 1) return '1 month';
    const yrs = Math.floor(months / 12);
    const mos = months % 12;
    if (yrs === 0) return `${mos} months`;
    if (mos === 0) return `${yrs} yr${yrs > 1 ? 's' : ''}`;
    return `${yrs} yr${yrs > 1 ? 's' : ''} ${mos} mo${mos > 1 ? 's' : ''}`;
  }

  function calculateFreedomDate(durationMonths, baseDate = new Date()) {
    if (!isFinite(durationMonths) || durationMonths >= 600) return 'Never';
    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + durationMonths, 1);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
  }

  // =========================================================================
  // 3. State / Context Factory & Pure Reducers
  // =========================================================================

  function createInitialContext(overrides = {}) {
    const currency = overrides.currency === 'USD' ? 'USD' : 'THB';
    const config = CURRENCY_CONFIG[currency];

    const defaultContext = {
      currency,
      exchangeRate: 35,
      purchaseAmount: currency === 'USD' ? 1500 : 52500,
      itemName: 'School Laptop',
      apr: 16.0, // Bank of Thailand statutory ceiling for cards
      strategy: 'minimum', // 'minimum', 'fixed', 'full', 'promo'
      minPayPercent: 8, // Bank of Thailand 2024 standard
      fixedPayAmount: config.defaultFixed,
      promoScenario: 'ideal', // 'ideal', 'slip11', 'slipmin'
      selectedMonthIndex: 0
    };

    return Object.freeze({
      ...defaultContext,
      ...overrides
    });
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function setCurrency(context, targetCurrency) {
    if (targetCurrency !== 'USD' && targetCurrency !== 'THB') return context;
    if (context.currency === targetCurrency) return context;

    const rate = context.exchangeRate || 35;
    const targetConfig = CURRENCY_CONFIG[targetCurrency];

    let newPurchaseAmount;
    let newFixedPay;

    if (targetCurrency === 'THB') {
      newPurchaseAmount = Math.round(context.purchaseAmount * rate);
      newFixedPay = Math.round(context.fixedPayAmount * rate);
    } else {
      newPurchaseAmount = Math.round(context.purchaseAmount / rate);
      newFixedPay = Math.round(context.fixedPayAmount / rate);
    }

    newPurchaseAmount = clamp(newPurchaseAmount, targetConfig.minPurchase, targetConfig.maxPurchase);
    newFixedPay = clamp(newFixedPay, targetConfig.minFixed, targetConfig.maxFixed);

    return Object.freeze({
      ...context,
      currency: targetCurrency,
      purchaseAmount: newPurchaseAmount,
      fixedPayAmount: newFixedPay,
      selectedMonthIndex: 0
    });
  }

  function setPurchaseAmount(context, amount) {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return context;
    const config = CURRENCY_CONFIG[context.currency];
    const clampedAmount = clamp(val, config.minPurchase, config.maxPurchase);

    return Object.freeze({
      ...context,
      purchaseAmount: clampedAmount,
      selectedMonthIndex: 0
    });
  }

  function selectPreset(context, presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return context;

    const amount = context.currency === 'THB' ? preset.thb : preset.usd;
    return Object.freeze({
      ...context,
      purchaseAmount: amount,
      itemName: preset.name,
      selectedMonthIndex: 0
    });
  }

  function setStrategy(context, strategy) {
    if (!STRATEGIES.includes(strategy)) return context;
    return Object.freeze({
      ...context,
      strategy,
      selectedMonthIndex: 0
    });
  }

  function setMinPayPercent(context, percent) {
    const val = Number(percent);
    if (isNaN(val)) return context;
    return Object.freeze({
      ...context,
      minPayPercent: clamp(val, 5, 15),
      selectedMonthIndex: 0
    });
  }

  function setFixedPayAmount(context, amount) {
    const val = Number(amount);
    if (isNaN(val)) return context;
    const config = CURRENCY_CONFIG[context.currency];
    return Object.freeze({
      ...context,
      fixedPayAmount: clamp(val, config.minFixed, config.maxFixed),
      selectedMonthIndex: 0
    });
  }

  function setPromoScenario(context, promoScenario) {
    if (!PROMO_SCENARIOS.includes(promoScenario)) return context;
    return Object.freeze({
      ...context,
      promoScenario,
      selectedMonthIndex: 0
    });
  }

  function setApr(context, apr) {
    const val = Number(apr);
    if (isNaN(val) || val < 0) return context;

    let newStrategy = context.strategy;
    if (val === 0) {
      newStrategy = 'promo';
    } else if (context.strategy === 'promo') {
      newStrategy = 'minimum';
    }

    return Object.freeze({
      ...context,
      apr: val,
      strategy: newStrategy,
      selectedMonthIndex: 0
    });
  }

  function selectMonthIndex(context, index) {
    const idx = Math.max(0, parseInt(index, 10) || 0);
    return Object.freeze({
      ...context,
      selectedMonthIndex: idx
    });
  }

  function reduce(context, action) {
    if (!action || !action.type) return context;
    switch (action.type) {
      case 'SET_CURRENCY':
        return setCurrency(context, action.currency);
      case 'SET_PURCHASE_AMOUNT':
        return setPurchaseAmount(context, action.amount);
      case 'SELECT_PRESET':
        return selectPreset(context, action.presetKey);
      case 'SET_STRATEGY':
        return setStrategy(context, action.strategy);
      case 'SET_MIN_PAY_PERCENT':
        return setMinPayPercent(context, action.percent);
      case 'SET_FIXED_PAY_AMOUNT':
        return setFixedPayAmount(context, action.amount);
      case 'SET_PROMO_SCENARIO':
        return setPromoScenario(context, action.promoScenario);
      case 'SET_APR':
        return setApr(context, action.apr);
      case 'SELECT_MONTH_INDEX':
        return selectMonthIndex(context, action.index);
      default:
        return context;
    }
  }

  // =========================================================================
  // 4. Mathematical Simulation Engine (Pure Functions)
  // =========================================================================

  function calculateSimulation(params) {
    const {
      principal = 0,
      apr = 16.0,
      strategy = 'minimum',
      minPayPercent = 8,
      fixedPay = 100,
      promoScenario = 'ideal',
      currency = 'THB'
    } = params;

    const monthlyRate = (apr / 100) / 12;
    const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.THB;
    const floorMin = config.floorMinPayment;
    const schedule = [];
    let currentBalance = principal;
    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;
    const maxMonths = 600;

    if (principal <= 0) {
      return {
        schedule: [],
        totalPaid: 0,
        totalInterest: 0,
        durationMonths: 0,
        firstPayment: 0,
        isInfinite: false
      };
    }

    // Path 1: Pay in Full (1 Month grace period, 0% interest)
    if (strategy === 'full') {
      return {
        schedule: [{
          month: 1,
          payment: principal,
          interest: 0,
          principalPaid: principal,
          balance: 0,
          isPromoActive: false
        }],
        totalPaid: principal,
        totalInterest: 0,
        durationMonths: 1,
        firstPayment: principal,
        isInfinite: false
      };
    }

    // Path 2: Disciplined 10-Month 0% Promo (Ideal)
    if (strategy === 'promo' && promoScenario === 'ideal') {
      const monthlyPayment = principal / 10;
      let bal = principal;
      for (let m = 1; m <= 10; m++) {
        const pay = m === 10 ? bal : monthlyPayment;
        bal = Math.max(0, bal - pay);
        schedule.push({
          month: m,
          payment: pay,
          interest: 0,
          principalPaid: pay,
          balance: bal,
          isPromoActive: true
        });
      }
      return {
        schedule,
        totalPaid: principal,
        totalInterest: 0,
        durationMonths: 10,
        firstPayment: monthlyPayment,
        isInfinite: false
      };
    }

    // Path 3: Promo 11-Month Slip (Retroactive penalty billed in Month 11)
    if (strategy === 'promo' && promoScenario === 'slip11') {
      const basePay = principal / 11;
      let bal = principal;
      let sumBalances = 0;

      for (let m = 1; m <= 10; m++) {
        bal = Math.max(0, bal - basePay);
        sumBalances += bal;
        schedule.push({
          month: m,
          payment: basePay,
          interest: 0,
          principalPaid: basePay,
          balance: bal,
          isPromoActive: true
        });
      }

      // Retroactive interest accumulated over months 1-10 on amortizing balances
      const backInterest = sumBalances * monthlyRate;
      const balEntering11 = bal + backInterest;
      const interest11 = balEntering11 * monthlyRate;
      const totalRetroInterest = backInterest + interest11;
      const finalPayment11 = bal + totalRetroInterest;

      schedule.push({
        month: 11,
        payment: finalPayment11,
        interest: totalRetroInterest,
        principalPaid: bal,
        balance: 0,
        isPromoActive: false
      });

      return {
        schedule,
        totalPaid: principal + totalRetroInterest,
        totalInterest: totalRetroInterest,
        durationMonths: 11,
        firstPayment: basePay,
        isInfinite: false
      };
    }

    // Path 4, 5, 6: Fixed Payment, Standard Minimum, or Promo Slipped to Minimum
    let calculatedFixedPay = fixedPay;
    let firstPaymentAmount = 0;
    let isInfinite = false;
    let accruedPromoBackInterest = 0;

    while (currentBalance > 0.005 && month < maxMonths) {
      month++;

      let isPromoActive = false;
      let activeMonthlyRate = monthlyRate;

      if (strategy === 'promo' && promoScenario === 'slipmin') {
        if (month <= 10) {
          isPromoActive = true;
          activeMonthlyRate = 0;
          accruedPromoBackInterest += currentBalance * monthlyRate;
        } else {
          isPromoActive = false;
          activeMonthlyRate = monthlyRate;
          if (month === 11 && accruedPromoBackInterest > 0) {
            currentBalance += accruedPromoBackInterest;
            totalInterest += accruedPromoBackInterest;
            accruedPromoBackInterest = 0;
          }
        }
      }

      const interestForMonth = currentBalance * activeMonthlyRate;
      let payment = 0;

      if (strategy === 'minimum' || (strategy === 'promo' && promoScenario === 'slipmin')) {
        const percentAmount = (currentBalance + interestForMonth) * (minPayPercent / 100);
        payment = Math.max(floorMin, percentAmount);
      } else {
        payment = calculatedFixedPay;
      }

      if (payment <= interestForMonth && currentBalance > 0.01) {
        isInfinite = true;
        break;
      }

      if (payment >= currentBalance + interestForMonth) {
        payment = currentBalance + interestForMonth;
      }

      const principalPaid = payment - interestForMonth;
      currentBalance = Math.max(0, currentBalance - principalPaid);
      totalInterest += interestForMonth;
      totalPaid += payment;

      if (month === 1) {
        firstPaymentAmount = payment;
      }

      schedule.push({
        month,
        payment,
        interest: interestForMonth,
        principalPaid,
        balance: currentBalance,
        isPromoActive
      });
    }

    if (month >= maxMonths) {
      isInfinite = true;
    }

    return {
      schedule,
      totalPaid,
      totalInterest,
      durationMonths: isInfinite ? Infinity : month,
      firstPayment: firstPaymentAmount,
      isInfinite
    };
  }

  // =========================================================================
  // 5. Derived Analysis & Projections (Opportunity Cost, Scenarios, Inspector)
  // =========================================================================

  function calculateOpportunityCost(totalInterest, currency = 'THB') {
    const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.THB;
    const catalog = config.oppCatalog;

    const items = catalog.map(item => ({
      icon: item.icon,
      name: item.name,
      cost: item.cost,
      count: Math.floor(Math.max(0, totalInterest) / item.cost)
    }));

    let summaryHtml = '';
    const currencyWord = getCurrencyWord(currency);

    if (totalInterest <= 0) {
      summaryHtml = `🎉 <strong>0 ${currencyWord} wasted!</strong> You kept 100% of your money. Zero interest given to the bank!`;
    } else {
      const item1 = items[0];
      const count1 = item1.count;
      const item2 = items[items.length - 1];
      const count2 = item2.count;

      if (count2 >= 1) {
        summaryHtml = `Instead of giving ${formatMoney(totalInterest, currency)} to the bank, you could have bought <strong>${count1.toLocaleString()} ${item1.name}</strong> or <strong>${count2} pair${count2 > 1 ? 's' : ''} of ${item2.name}</strong>!`;
      } else {
        summaryHtml = `Instead of donating ${formatMoney(totalInterest, currency)} to bank profits, you could have enjoyed <strong>${count1.toLocaleString()} ${item1.name}</strong>!`;
      }
    }

    return {
      totalInterest,
      items,
      summaryHtml
    };
  }

  function calculatePaycheckDrain(firstPayment, currency = 'THB') {
    const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.THB;
    const baseBudget = config.baseBudget;
    const debtPct = Math.min(95, Math.max(5, Math.round((firstPayment / baseBudget) * 100)));
    const livingPct = 100 - debtPct;
    const livingAmount = Math.max(0, baseBudget - firstPayment);

    return {
      baseBudget,
      firstPayment,
      debtPct,
      livingPct,
      livingAmount
    };
  }

  function calculateComparisonTable(context) {
    const P = context.purchaseAmount;
    const apr = context.apr;
    const cur = context.currency;

    const scenarios = [
      {
        id: 'full',
        name: 'Pay in Full (1 Month)',
        badge: 'badge-green',
        badgeText: 'Smartest',
        params: { principal: P, apr, strategy: 'full', currency: cur },
        isCurrent: context.strategy === 'full'
      },
      {
        id: 'promo_ideal',
        name: '0% Promo: 1. Ideal (≤10 Mos)',
        badge: 'badge-green',
        badgeText: cur === 'THB' ? '฿0 Interest 🏆' : '$0 Interest 🏆',
        params: { principal: P, apr, strategy: 'promo', promoScenario: 'ideal', currency: cur },
        isCurrent: context.strategy === 'promo' && context.promoScenario === 'ideal'
      },
      {
        id: 'promo_slip11',
        name: '0% Promo: 2. Slipped to 11 Mos',
        badge: 'badge-amber',
        badgeText: 'Retroactive Penalty ⚠️',
        params: { principal: P, apr, strategy: 'promo', promoScenario: 'slip11', currency: cur },
        isCurrent: context.strategy === 'promo' && context.promoScenario === 'slip11'
      },
      {
        id: 'promo_slipmin',
        name: '0% Promo: 3. Slipped to Min 8%',
        badge: 'badge-red',
        badgeText: '3+ Year Trap 🚨',
        params: { principal: P, apr, strategy: 'promo', promoScenario: 'slipmin', currency: cur },
        isCurrent: context.strategy === 'promo' && context.promoScenario === 'slipmin'
      },
      {
        id: 'fixed',
        name: 'Fixed Monthly Amount',
        badge: 'badge-blue',
        badgeText: 'Disciplined',
        params: { principal: P, apr, strategy: 'fixed', fixedPay: context.fixedPayAmount, currency: cur },
        isCurrent: context.strategy === 'fixed'
      },
      {
        id: 'minimum',
        name: `Minimum Only (${context.minPayPercent}%)`,
        badge: 'badge-red',
        badgeText: 'The Trap 🪤',
        params: { principal: P, apr, strategy: 'minimum', minPayPercent: context.minPayPercent, currency: cur },
        isCurrent: context.strategy === 'minimum'
      }
    ];

    return scenarios.map(sc => {
      const sim = calculateSimulation(sc.params);
      return {
        ...sc,
        result: sim
      };
    });
  }

  function calculateRemainingInterests(schedule) {
    if (!schedule || schedule.length === 0) return [];
    const totalMonths = schedule.length;
    const remainingInterests = new Array(totalMonths);
    let runningInterest = 0;
    for (let i = totalMonths - 1; i >= 0; i--) {
      runningInterest += schedule[i].interest;
      remainingInterests[i] = runningInterest;
    }
    return remainingInterests;
  }

  function calculateMonthDetail(schedule, selectedIndex, strategy, apr, currency) {
    if (!schedule || schedule.length === 0) return null;
    const totalMonths = schedule.length;
    const clampedIdx = Math.max(0, Math.min(totalMonths - 1, selectedIndex));
    const row = schedule[clampedIdx];
    const remInterests = calculateRemainingInterests(schedule);
    const remInt = remInterests[clampedIdx] || 0;
    const totalDebt = row.balance + remInt;
    const m = row.month;

    let badgeText = `Month ${m}`;
    if (row.isPromoActive) {
      badgeText = `Month ${m} (0% Promo 🟢)`;
    } else if (m === 11 && strategy === 'promo') {
      badgeText = `Month 11 (⚠️ Promo Expired!)`;
    }

    const timeElapsedText = m >= 12
      ? `${formatMonths(m)} into repayment`
      : `${m} month${m > 1 ? 's' : ''} into repayment`;

    const progressPillText = `Month ${m} of ${totalMonths} (${formatMonths(totalMonths)})`;

    let paymentSplitText = `${formatMoney(row.principalPaid, currency)} to item • ${formatMoney(row.interest, currency)} bank interest`;
    if (row.isPromoActive) {
      paymentSplitText = `${formatMoney(row.principalPaid, currency)} to purchase • 0 interest (0% Promo)`;
    }

    let remainingHint = '';
    const remMonths = totalMonths - m;
    if (remMonths === 0) {
      remainingHint = '🎉 Debt-free! You made your final payment!';
    } else if (row.isPromoActive && m === 10 && totalMonths > 10) {
      remainingHint = `⚠️ Month 10: Final month of 0% promo! Because 100% of the debt wasn't cleared, standard ${apr}% APR kicks in at Month 11 on your ${formatMoney(row.balance, currency)} remaining debt.`;
    } else if (row.isPromoActive && m <= 10) {
      remainingHint = `🟢 0% Promotional Window. You must pay off all ${formatMoney(row.balance, currency)} by Month 10 to keep 0% interest!`;
    } else if (m === 11 && strategy === 'promo') {
      remainingHint = `🚨 0% PROMO HAS EXPIRED! The debt was not cleared in 10 months. Standard ${apr}% APR is now charging interest!`;
    } else {
      remainingHint = `${remMonths} month${remMonths > 1 ? 's' : ''} (${formatMonths(remMonths)}) remaining`;
    }

    return {
      selectedIndex: clampedIdx,
      month: m,
      totalMonths,
      row,
      remInterest: remInt,
      totalDebt,
      badgeText,
      timeElapsedText,
      progressPillText,
      paymentSplitText,
      remainingHint
    };
  }

  // =========================================================================
  // 6. Complete Pure View-Model Generator
  // =========================================================================

  function computeViewModel(context) {
    const cur = context.currency;
    const P = context.purchaseAmount;
    const apr = context.apr;

    // 1. Current selected simulation
    const currentSim = calculateSimulation({
      principal: P,
      apr,
      strategy: context.strategy,
      minPayPercent: context.minPayPercent,
      fixedPay: context.fixedPayAmount,
      promoScenario: context.promoScenario,
      currency: cur
    });

    // 2. Antidote Benchmarks (Minimum vs Fixed)
    const minBenchmark = calculateSimulation({
      principal: P,
      apr,
      strategy: 'minimum',
      minPayPercent: context.minPayPercent,
      currency: cur
    });

    const fixedBenchmark = calculateSimulation({
      principal: P,
      apr,
      strategy: 'fixed',
      fixedPay: context.fixedPayAmount,
      currency: cur
    });

    // 3. Comparison Scenarios (All 6 paths)
    const comparisonScenarios = calculateComparisonTable(context);

    // 4. Opportunity Cost
    const oppCost = calculateOpportunityCost(currentSim.totalInterest, cur);

    // 5. Paycheck Drain
    const paycheckDrain = calculatePaycheckDrain(currentSim.firstPayment, cur);

    // 6. First Month Treadmill Split
    const firstMonthInterest = context.strategy === 'promo' && currentSim.schedule[0]?.isPromoActive
      ? 0
      : P * ((apr / 100) / 12);
    const firstMonthPrincipal = currentSim.firstPayment - firstMonthInterest;

    // 7. Markup & Impatience Tax
    const markupPct = P > 0 ? ((currentSim.totalInterest / P) * 100).toFixed(1) : '0.0';

    // 8. Cost Ratio Percentages
    const principalPct = currentSim.totalPaid > 0
      ? Math.max(10, Math.min(100, Math.round((P / currentSim.totalPaid) * 100)))
      : 100;
    const interestPct = 100 - principalPct;

    // 9. Product Life Reality Warning
    const freedomDateStr = calculateFreedomDate(currentSim.durationMonths);
    const freedomYear = freedomDateStr.split(' ')[1] || '';
    const showProductAgeWarning = currentSim.durationMonths > 10;

    // 10. Month Detail Inspector
    const monthDetail = calculateMonthDetail(
      currentSim.schedule,
      context.selectedMonthIndex,
      context.strategy,
      apr,
      cur
    );

    // 11. Promo Scenario Banner Text
    let promoBannerHtml = '';
    if (context.promoScenario === 'ideal') {
      promoBannerHtml = `
        🌟 <strong>Option 1: The Ideal Win (≤10 Months)</strong><br>
        Pay <strong>${formatMoney(P / 10, cur)}/month</strong> for exactly 10 months. You clear 100% of the purchase on schedule with <strong>${cur === 'THB' ? '฿0' : '$0'} interest</strong>!
      `;
    } else if (context.promoScenario === 'slip11') {
      const simSlip11 = calculateSimulation({ principal: P, apr, strategy: 'promo', promoScenario: 'slip11', currency: cur });
      promoBannerHtml = `
        ⚠️ <strong>Option 2: The 11-Month Slip (The Fine-Print Trap!)</strong><br>
        You planned for 11 months, paying <strong>${formatMoney(P / 11, cur)}/mo</strong> in months 1–10. But because you owed a balance entering Month 11, the 0% deal was revoked! The bank retroactively billed <strong>+${formatMoney(simSlip11.totalInterest, cur)} in back-interest</strong> from Day 1, making Month 11's final bill <strong>${formatMoney(simSlip11.schedule[10]?.payment || 0, cur)}</strong>!
      `;
    } else if (context.promoScenario === 'slipmin') {
      const simSlipMin = calculateSimulation({ principal: P, apr, strategy: 'promo', promoScenario: 'slipmin', currency: cur });
      promoBannerHtml = `
        🚨 <strong>Option 3: The Full Minimum Trap (3+ Years!)</strong><br>
        You dropped to paying only the required 8% minimum. At Month 11 the 0% deal expired, compounding ${apr}% APR for <strong>${formatMonths(simSlipMin.durationMonths)}</strong> and costing <strong>+${formatMoney(simSlipMin.totalInterest, cur)}</strong> in interest!
      `;
    }

    return Object.freeze({
      context,
      currentSim,
      minBenchmark,
      fixedBenchmark,
      comparisonScenarios,
      oppCost,
      paycheckDrain,
      firstMonthSplit: {
        totalPayment: currentSim.firstPayment,
        principalPaid: firstMonthPrincipal,
        interestPaid: firstMonthInterest
      },
      markupPct,
      costRatio: {
        principalPct,
        interestPct
      },
      freedomDateStr,
      durationMonthsFormatted: formatMonths(currentSim.durationMonths),
      productAgeWarning: {
        show: showProductAgeWarning,
        year: freedomYear,
        itemName: context.itemName
      },
      promoBannerHtml,
      monthDetail
    });
  }

  // =========================================================================
  // 7. Story Mode Simulation Parameter Resolver
  // =========================================================================

  function getStorySimulationParams(storyState, cur = 'THB', laptopPrice) {
    const currency = cur || 'THB';
    const principal = laptopPrice || (currency === 'USD' ? 1500 : 52500);
    const apr = 16; // Bank of Thailand official standard credit card APR ceiling

    if (storyState.financing === 'card') {
      if (storyState.habit === 'min') {
        return { principal, apr, strategy: 'minimum', minPayPercent: 8, currency };
      }
      if (storyState.habit === 'fixed') {
        return { principal, apr, strategy: 'fixed', fixedPay: currency === 'THB' ? 5000 : 150, currency };
      }
      return { principal, apr, strategy: 'full', currency };
    }

    // storyState.financing === 'promo'
    if (storyState.habit === 'slip11') {
      return { principal, apr, strategy: 'promo', promoScenario: 'slip11', currency };
    }
    if (storyState.habit === 'slipmin') {
      return { principal, apr, strategy: 'promo', promoScenario: 'slipmin', minPayPercent: 8, currency };
    }
    return { principal, apr, strategy: 'promo', promoScenario: 'ideal', currency };
  }

  // =========================================================================
  // Public Exports
  // =========================================================================

  return {
    PRESETS,
    CURRENCY_CONFIG,
    STRATEGIES,
    PROMO_SCENARIOS,

    // Formatting
    formatMoney,
    getCurrencyWord,
    formatMonths,
    calculateFreedomDate,

    // Context & Reducers
    createInitialContext,
    setCurrency,
    setPurchaseAmount,
    selectPreset,
    setStrategy,
    setMinPayPercent,
    setFixedPayAmount,
    setPromoScenario,
    setApr,
    selectMonthIndex,
    reduce,

    // Mathematical Engine & Analytics
    calculateSimulation,
    calculateOpportunityCost,
    calculatePaycheckDrain,
    calculateComparisonTable,
    calculateRemainingInterests,
    calculateMonthDetail,
    computeViewModel,
    getStorySimulationParams
  };
});
