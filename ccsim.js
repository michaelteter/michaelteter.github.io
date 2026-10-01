/**
 * Credit Card Reality Simulator (ccsim.js)
 * High school educational personal finance tool
 * Client-side only, pure modern vanilla JavaScript
 */

(function () {
  'use strict';

  // Read optional URL parameter: e.g. ccsim.html?currency=USD
  const urlParams = new URLSearchParams(window.location.search);
  const initialCurrency = urlParams.get('currency')?.toUpperCase() === 'USD' ? 'USD' : 'THB';

  // State
  const state = {
    currency: initialCurrency, // Default 'THB', flexible to 'USD'
    exchangeRate: 35, // 1 USD ~ 35 THB
    purchaseAmount: initialCurrency === 'USD' ? 1500 : 52500,
    apr: 16.0, // Default 16% (Bank of Thailand standard cap)
    strategy: 'minimum', // 'minimum', 'fixed', 'duration', 'promo', 'full'
    minPayPercent: 8, // Thai BOT 2024 standard
    fixedPayAmount: initialCurrency === 'USD' ? 100 : 3500,
    targetMonths: 12,
    promoMode: 'ontime', // 'ontime' (pay in 10 mos) or 'slip' (slip past 10 mos)
    promoSlipTarget: '12', // '12', '14', '18', '24', 'min'
    spotlightSlipTarget: '12', // '12', '14', '18', '24', 'min'
    selectedMonthIndex: 0,
    currentSchedule: [],
    currentRemainingInterests: []
  };

  // DOM Elements
  const el = {
    currencyPrefix: document.getElementById('currencyPrefix'),
    purchaseAmount: document.getElementById('purchaseAmount'),
    purchaseAmountDisplay: document.getElementById('purchaseAmountDisplay'),
    presetChips: document.querySelectorAll('.chip'),
    aprDisplay: document.getElementById('aprDisplay'),
    rateBtns: document.querySelectorAll('.rate-btn'),
    strategyRadios: document.querySelectorAll('input[name="payStrategy"]'),
    
    // Strategy panels
    minPayOptions: document.getElementById('minPayOptions'),
    fixedPayOptions: document.getElementById('fixedPayOptions'),
    durationPayOptions: document.getElementById('durationPayOptions'),
    promoPayOptions: document.getElementById('promoPayOptions'),
    fullPayOptions: document.getElementById('fullPayOptions'),
    
    minPayPercent: document.getElementById('minPayPercent'),
    minPayPercentDisplay: document.getElementById('minPayPercentDisplay'),
    minPayHint: document.getElementById('minPayHint'),
    fullPaySuccessBanner: document.getElementById('fullPaySuccessBanner'),

    fixedPayAmount: document.getElementById('fixedPayAmount'),
    fixedPayAmountDisplay: document.getElementById('fixedPayAmountDisplay'),
    quickFixedBtns: document.querySelectorAll('.pill-btn:not([data-promo-slip])'),
    targetMonths: document.getElementById('targetMonths'),
    targetMonthsDisplay: document.getElementById('targetMonthsDisplay'),

    // Promo Strategy Panel Elements
    btnPromoModeOntime: document.getElementById('btnPromoModeOntime'),
    btnPromoModeSlip: document.getElementById('btnPromoModeSlip'),
    promoOnTimeSubView: document.getElementById('promoOnTimeSubView'),
    promoSlipSubView: document.getElementById('promoSlipSubView'),
    promoOnTimeAmountDisplay: document.getElementById('promoOnTimeAmountDisplay'),
    promoOnTimeBanner: document.getElementById('promoOnTimeBanner'),
    promoSlipQuickBtns: document.querySelectorAll('#promoSlipQuickBtns .pill-btn'),
    promoSlipStrategyHint: document.getElementById('promoSlipStrategyHint'),

    // Spotlight Card Elements
    promoSpotlightCard: document.getElementById('promoSpotlightCard'),
    spotlightOntimeMonthly: document.getElementById('spotlightOntimeMonthly'),
    spotlightOntimeTotal: document.getElementById('spotlightOntimeTotal'),
    spotlightSlipPills: document.querySelectorAll('#spotlightSlipPills .slip-pill'),
    spotlightSlippedMonthly: document.getElementById('spotlightSlippedMonthly'),
    spotlightSlippedPaymentLabel: document.getElementById('spotlightSlippedPaymentLabel'),
    spotlightSlippedInterest: document.getElementById('spotlightSlippedInterest'),
    spotlightSlippedTotal: document.getElementById('spotlightSlippedTotal'),
    spotlightSlippedDuration: document.getElementById('spotlightSlippedDuration'),
    spotlightSlippedExtraTime: document.getElementById('spotlightSlippedExtraTime'),
    spotlightSlippedNote: document.getElementById('spotlightSlippedNote'),
    spotlightDiffContent: document.getElementById('spotlightDiffContent'),
    btnSimulateOntime: document.getElementById('btnSimulateOntime'),
    btnSimulateSlipped: document.getElementById('btnSimulateSlipped'),
    
    // Metric displays
    resTotalPaid: document.getElementById('resTotalPaid'),
    resOriginalPrice: document.getElementById('resOriginalPrice'),
    resTotalInterest: document.getElementById('resTotalInterest'),
    resInterestPercent: document.getElementById('resInterestPercent'),
    resDuration: document.getElementById('resDuration'),
    resTimeSub: document.getElementById('resTimeSub'),
    resFirstPayment: document.getElementById('resFirstPayment'),
    resPaymentNote: document.getElementById('resPaymentNote'),
    
    // Visual breakdown
    barPrincipal: document.getElementById('barPrincipal'),
    barInterest: document.getElementById('barInterest'),
    breakdownRatio: document.getElementById('breakdownRatio'),
    
    // Alert Box
    realityAlertBox: document.getElementById('realityAlertBox'),
    alertIcon: document.getElementById('alertIcon'),
    alertTitle: document.getElementById('alertTitle'),
    alertDescription: document.getElementById('alertDescription'),
    
    // Opportunity cost
    oppInterestAmount: document.getElementById('oppInterestAmount'),
    oppItemsGrid: document.getElementById('oppItemsGrid'),
    
    // Comparison Table
    comparisonTableBody: document.getElementById('comparisonTableBody'),
    
    // SVG Chart & Tooltip
    balanceChart: document.getElementById('balanceChart'),
    chartContainer: document.getElementById('chartContainer'),
    chartTooltip: document.getElementById('chartTooltip'),
    chartMidMonth: document.getElementById('chartMidMonth'),
    chartEndMonth: document.getElementById('chartEndMonth'),
    amortizationSection: document.getElementById('amortizationSection'),
    
    // Selected Month Detail Card (iPad & touch friendly)
    monthDetailCard: document.getElementById('monthDetailCard'),
    detailBadge: document.getElementById('detailBadge'),
    detailTimeElapsed: document.getElementById('detailTimeElapsed'),
    detailProgressPill: document.getElementById('detailProgressPill'),
    detailTotalDebt: document.getElementById('detailTotalDebt'),
    detailPrincipalLeft: document.getElementById('detailPrincipalLeft'),
    detailInterestLeft: document.getElementById('detailInterestLeft'),
    detailPayment: document.getElementById('detailPayment'),
    detailPaymentSplit: document.getElementById('detailPaymentSplit'),
    detailEndingBalance: document.getElementById('detailEndingBalance'),
    detailRemainingMonths: document.getElementById('detailRemainingMonths')
  };

  // Helper formatting functions
  function formatMoney(amount, currency = state.currency) {
    if (isNaN(amount) || !isFinite(amount)) return '∞';
    if (currency === 'THB') {
      return '฿' + Math.round(amount).toLocaleString('en-US');
    }
    return '$' + amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Currency unit word helper: returns "baht" or "dollar"/"dollars" depending on active currency
  function getCurrencyWord(plural = false, capitalize = false) {
    let word = '';
    if (state.currency === 'THB') {
      word = 'baht';
    } else {
      word = plural ? 'dollars' : 'dollar';
    }
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
    if (mos === 0) return `${yrs} year${yrs > 1 ? 's' : ''}`;
    return `${yrs} year${yrs > 1 ? 's' : ''} ${mos} month${mos > 1 ? 's' : ''}`;
  }

  // Simulation Core Engine
  function runSimulation(params) {
    const {
      principal,
      apr,
      strategy,
      minPayPercent = 8,
      fixedPay = 100,
      targetMonths = 12,
      promoMode = state.promoMode || 'ontime',
      promoSlipTarget = state.promoSlipTarget || '12',
      currency = state.currency
    } = params;

    const monthlyRate = (apr / 100) / 12;
    const floorMin = currency === 'THB' ? 500 : 25; // Thai BOT minimum 500 THB or $25
    const schedule = [];
    let currentBalance = principal;
    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;
    const maxMonths = 600; // 50-year cap to prevent infinite loop

    // Special case 1: Pay in full
    if (strategy === 'full' || (apr === 0 && strategy !== 'promo' && targetMonths === 1)) {
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

    // Special case 2: Disciplined 10-Month 0% Promo (Pay in 10 Months)
    if (strategy === 'promo' && promoMode === 'ontime') {
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

    // Target duration or Slipped Promo amortized payment calculation
    let calculatedFixedPay = fixedPay;
    if (strategy === 'duration') {
      if (monthlyRate === 0) {
        calculatedFixedPay = principal / targetMonths;
      } else {
        calculatedFixedPay = principal * (monthlyRate * Math.pow(1 + monthlyRate, targetMonths)) /
                             (Math.pow(1 + monthlyRate, targetMonths) - 1);
      }
    } else if (strategy === 'promo' && promoMode === 'slip') {
      if (promoSlipTarget === 'min') {
        // Handled in while loop
      } else {
        const targetM = parseInt(promoSlipTarget, 10) || 12;
        const promoM = 10;
        const k = targetM - promoM;
        if (k <= 0) {
          calculatedFixedPay = principal / targetM;
        } else {
          // In months 1..10, payment X has rate 0.
          // Remaining balance B10 = P - 10*X is amortized over k months at monthlyRate:
          // B10 = X * (1 - (1+monthlyRate)^(-k)) / monthlyRate
          // P = X * (10 + Ak) => X = P / (10 + Ak)
          const Ak = monthlyRate > 0 ? (1 - Math.pow(1 + monthlyRate, -k)) / monthlyRate : k;
          calculatedFixedPay = principal / (promoM + Ak);
        }
      }
    }

    let firstPaymentAmount = 0;
    let isInfinite = false;

    while (currentBalance > 0.005 && month < maxMonths) {
      month++;

      // In a 0% promo, months 1..10 have 0% APR.
      // Starting month 11, standard APR kicks in on the remaining balance!
      let isPromoActive = false;
      let activeMonthlyRate = monthlyRate;
      if (strategy === 'promo') {
        if (month <= 10) {
          isPromoActive = true;
          activeMonthlyRate = 0;
        } else {
          isPromoActive = false;
          activeMonthlyRate = monthlyRate;
        }
      }

      const interestForMonth = currentBalance * activeMonthlyRate;

      let payment = 0;
      if (strategy === 'minimum' || (strategy === 'promo' && promoMode === 'slip' && promoSlipTarget === 'min')) {
        const percentAmount = (currentBalance + interestForMonth) * (minPayPercent / 100);
        payment = Math.max(floorMin, percentAmount);
      } else {
        // fixed, duration, or promo slip fixed payment
        payment = calculatedFixedPay;
      }

      // Check if payment fails to even cover the month's interest
      if (payment <= interestForMonth && currentBalance > 0.01) {
        // Negative amortization / infinite debt
        isInfinite = true;
        break;
      }

      // If payment exceeds remaining balance + interest, pay off balance
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

  // Update opportunity cost items
  function updateOpportunityCost(totalInterest) {
    el.oppInterestAmount.textContent = formatMoney(totalInterest);

    let items = [];
    if (state.currency === 'THB') {
      // Thai student relatable costs in THB
      items = [
        { icon: '🧋', name: 'Thai Milk Teas', cost: 50 },
        { icon: '🍜', name: 'Bowls of Pad Thai', cost: 60 },
        { icon: '🎬', name: 'Movie Tickets', cost: 240 },
        { icon: '🎧', name: 'Months of Spotify', cost: 139 },
        { icon: '📱', name: 'AirPods (approx)', cost: 5500 }
      ];
    } else {
      // Relatable costs in USD
      items = [
        { icon: '🧋', name: 'Boba Drinks', cost: 5.5 },
        { icon: '🍕', name: 'Large Pizzas', cost: 18 },
        { icon: '🎬', name: 'Cinema Outings', cost: 15 },
        { icon: '🎧', name: 'Months of Spotify', cost: 11 },
        { icon: '🎮', name: 'New Video Games', cost: 70 }
      ];
    }

    el.oppItemsGrid.innerHTML = '';
    items.forEach(item => {
      const count = Math.floor(totalInterest / item.cost);
      if (count > 0) {
        const card = document.createElement('div');
        card.className = 'opp-item';
        card.innerHTML = `
          <div class="opp-item-icon">${item.icon}</div>
          <div class="opp-item-count">${count.toLocaleString()}</div>
          <div class="opp-item-name">${item.name}</div>
        `;
        el.oppItemsGrid.appendChild(card);
      }
    });

    if (el.oppItemsGrid.children.length === 0) {
      const curUnit = getCurrencyWord();
      el.oppItemsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem;">
          🎉 0 ${curUnit} interest wasted! You paid off your card without donating money to the bank.
        </div>
      `;
    }
  }

  // Update Selected Month Detail Card (iPad friendly)
  function updateMonthDetail(idx) {
    if (!state.currentSchedule || state.currentSchedule.length === 0) return;
    const totalMonths = state.currentSchedule.length;
    const clampedIdx = Math.max(0, Math.min(totalMonths - 1, idx));
    state.selectedMonthIndex = clampedIdx;

    const row = state.currentSchedule[clampedIdx];
    const remInt = state.currentRemainingInterests[clampedIdx] || 0;
    const totalDebt = row.balance + remInt;
    const m = row.month;

    if (el.detailBadge) {
      if (row.isPromoActive) {
        el.detailBadge.textContent = `Month ${m} (0% Promo 🟢)`;
      } else if (m === 11 && (state.strategy === 'promo' || totalMonths > 10)) {
        el.detailBadge.textContent = `Month 11 (⚠️ Promo Expired!)`;
      } else if (m > 11 && state.strategy === 'promo') {
        el.detailBadge.textContent = `Month ${m} (${state.apr.toFixed(0)}% APR Debt)`;
      } else {
        el.detailBadge.textContent = `Month ${m}`;
      }
    }
    if (el.detailTimeElapsed) {
      el.detailTimeElapsed.textContent = m >= 12 
        ? `${formatMonths(m)} into repayment` 
        : `${m} month${m > 1 ? 's' : ''} into repayment`;
    }
    if (el.detailProgressPill) {
      el.detailProgressPill.textContent = `Month ${m} of ${totalMonths} (${formatMonths(totalMonths)})`;
    }

    if (el.detailTotalDebt) el.detailTotalDebt.textContent = formatMoney(totalDebt);
    if (el.detailPrincipalLeft) el.detailPrincipalLeft.textContent = `${formatMoney(row.balance)} Principal`;
    if (el.detailInterestLeft) el.detailInterestLeft.textContent = `+${formatMoney(remInt)} Debt Interest`;

    if (el.detailPayment) el.detailPayment.textContent = formatMoney(row.payment);
    if (el.detailPaymentSplit) {
      if (row.isPromoActive) {
        el.detailPaymentSplit.textContent = `${formatMoney(row.principalPaid)} to purchase • ฿0 interest (0% Promo Plan)`;
      } else {
        el.detailPaymentSplit.textContent = `${formatMoney(row.principalPaid)} to purchase • ${formatMoney(row.interest)} bank profit`;
      }
    }

    if (el.detailEndingBalance) el.detailEndingBalance.textContent = formatMoney(row.balance);
    if (el.detailRemainingMonths) {
      const remMonths = totalMonths - m;
      if (remMonths === 0) {
        el.detailRemainingMonths.textContent = '🎉 Debt-free! You made your final payment!';
      } else if (row.isPromoActive && m === 10 && totalMonths > 10) {
        el.detailRemainingMonths.textContent = `⚠️ Month 10: Final month of 0% promo! Starting Month 11, ${state.apr}% APR kicks in on your ${formatMoney(row.balance)} remaining debt.`;
      } else if (row.isPromoActive) {
        el.detailRemainingMonths.textContent = `🟢 Within 10-month promotional window. ${remMonths} months left to clear debt before APR kicks in.`;
      } else if (m === 11 && state.strategy === 'promo') {
        el.detailRemainingMonths.textContent = `🚨 0% PROMO HAS EXPIRED! Standard ${state.apr}% APR is now compounding on your remaining debt.`;
      } else {
        el.detailRemainingMonths.textContent = `${remMonths} month${remMonths > 1 ? 's' : ''} (${formatMonths(remMonths)}) remaining to payoff`;
      }
    }

    // Update active highlight on SVG bars
    const barGroups = el.balanceChart.querySelectorAll('.bar-group');
    barGroups.forEach((g, gIdx) => {
      g.classList.toggle('selected', gIdx === clampedIdx);
    });
  }

  // Render SVG Chart of Stacked Amortization Bars (Tappable & Draggable on iPad)
  function renderChart(schedule, initialPrincipal) {
    const svg = el.balanceChart;
    const width = 800;
    const height = 240;
    const padLeft = 60;
    const padRight = 35;
    const padTop = 30;
    const padBottom = 35;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const yZero = padTop + plotHeight;

    if (!schedule || schedule.length === 0) {
      svg.innerHTML = '';
      return;
    }

    state.currentSchedule = schedule;
    const totalMonths = schedule.length;
    const midMonth = Math.max(1, Math.round(totalMonths / 2));
    el.chartMidMonth.textContent = formatMonths(midMonth);
    el.chartEndMonth.textContent = `${formatMonths(totalMonths)} (Debt-Free 🎉)`;

    // Precalculate remaining future interest for each month (including current month)
    const remainingInterests = new Array(totalMonths);
    let runningInterest = 0;
    for (let i = totalMonths - 1; i >= 0; i--) {
      runningInterest += schedule[i].interest;
      remainingInterests[i] = runningInterest;
    }
    state.currentRemainingInterests = remainingInterests;

    // Total initial debt = principal + all interest
    const initialTotalDebt = initialPrincipal + (remainingInterests[0] || 0);
    const maxY = Math.max(initialPrincipal * 1.05, initialTotalDebt * 1.05);

    // Coordinate mapping functions
    const getY = (val) => yZero - (val / maxY) * plotHeight;

    // Y-axis tick marks
    const yTicks = [0, maxY * 0.5, maxY];
    let gridLinesHtml = '';
    yTicks.forEach(tickVal => {
      const y = getY(tickVal);
      gridLinesHtml += `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
        <text x="${padLeft - 8}" y="${y + 4}" font-size="11" fill="#64748b" text-anchor="end" font-family="system-ui">${formatMoney(tickVal)}</text>
      `;
    });

    // Base axes
    const axesHtml = `
      <line x1="${padLeft}" y1="${yZero}" x2="${width - padRight}" y2="${yZero}" stroke="#cbd5e1" stroke-width="1.5" />
      <line x1="${padLeft}" y1="${padTop - 5}" x2="${padLeft}" y2="${yZero}" stroke="#cbd5e1" stroke-width="1.5" />
    `;

    // Bar dimensions
    const slotWidth = plotWidth / totalMonths;
    const barWidth = Math.max(2, Math.min(28, slotWidth * 0.72));

    let barsHtml = '';
    state.selectedMonthIndex = Math.max(0, Math.min(totalMonths - 1, state.selectedMonthIndex));

    schedule.forEach((row, idx) => {
      const xCenter = padLeft + (idx + 0.5) * slotWidth;
      const xLeft = xCenter - barWidth / 2;
      const remInt = remainingInterests[idx] || 0;

      // Heights
      const principalHeight = Math.max(0, (row.balance / maxY) * plotHeight);
      const interestHeight = Math.max(0, (remInt / maxY) * plotHeight);
      const totalBarHeight = principalHeight + interestHeight;

      const yPrincipal = yZero - principalHeight;
      const yDebt = yZero - totalBarHeight;
      const isSelected = (idx === state.selectedMonthIndex);

      // SVG Bar Group
      barsHtml += `
        <g class="bar-group ${isSelected ? 'selected' : ''}" data-idx="${idx}" data-month="${row.month}">
          <!-- Blue Principal bar on bottom -->
          <rect class="bar-principal" x="${xLeft}" y="${yPrincipal}" width="${barWidth}" height="${principalHeight}" fill="#3b82f6" rx="1" />
          <!-- Red Interest/Debt bar stacked on top -->
          <rect class="bar-debt" x="${xLeft}" y="${yDebt}" width="${barWidth}" height="${interestHeight}" fill="#ef4444" rx="1" />
          <!-- Hitbox for seamless finger dragging / tapping -->
          <rect class="bar-hitbox" x="${xCenter - slotWidth / 2}" y="${padTop}" width="${slotWidth}" height="${plotHeight + 10}" fill="transparent" />
        </g>
      `;
    });

    svg.innerHTML = gridLinesHtml + axesHtml + barsHtml;

    // Update detail box for currently selected month
    updateMonthDetail(state.selectedMonthIndex);
  }

  // Populate Comparison Table
  function renderComparisonTable(currentResult) {
    const P = state.purchaseAmount;
    const apr = state.apr;

    const scenarios = [];

    // 1. Pay in Full
    scenarios.push({
      id: 'full',
      name: 'Pay in Full (1 Month)',
      params: { principal: P, apr, strategy: 'full' },
      badge: 'badge-green',
      badgeText: 'Smartest',
      isCurrent: (state.strategy === 'full')
    });

    // 2. 0% 10-Month Promo: Disciplined (10 Months)
    scenarios.push({
      id: 'promo-ontime',
      name: '0% Promo (Paid in 10 Mos)',
      params: { principal: P, apr, strategy: 'promo', promoMode: 'ontime' },
      badge: 'badge-green',
      badgeText: 'Mall 0% 🇹🇭',
      isCurrent: (state.strategy === 'promo' && state.promoMode === 'ontime')
    });

    // 3. 0% Promo: Slipped into 12+ Months
    const slipTarget = (state.strategy === 'promo' && state.promoMode === 'slip') ? state.promoSlipTarget : '14';
    const slipLabel = slipTarget === 'min' ? 'Slipped to Min 8%' : `Slipped to ${slipTarget} Mos`;
    scenarios.push({
      id: 'promo-slipped',
      name: `0% Promo (${slipLabel})`,
      params: { principal: P, apr, strategy: 'promo', promoMode: 'slip', promoSlipTarget: slipTarget },
      badge: 'badge-amber',
      badgeText: 'Slipped Trap ⚠️',
      isCurrent: (state.strategy === 'promo' && state.promoMode === 'slip')
    });

    // 4. Active Selection & Comparative Benchmarks
    if (state.strategy === 'fixed') {
      // User's exact chosen fixed payment
      scenarios.push({
        id: 'current-fixed',
        name: `Your Choice: Fixed ${formatMoney(state.fixedPayAmount)}/mo`,
        params: { principal: P, apr, strategy: 'fixed', fixedPay: state.fixedPayAmount },
        badge: 'badge-blue',
        badgeText: 'Your Plan',
        isCurrent: true
      });

      // Show a faster alternative fixed plan for contrast if meaningful
      let altFixed;
      if (state.currency === 'THB') {
        if (state.fixedPayAmount < 3500) altFixed = 3500;
        else if (state.fixedPayAmount < 5000) altFixed = 5000;
        else if (state.fixedPayAmount < 10000) altFixed = 10000;
        else altFixed = Math.round(state.fixedPayAmount * 1.5 / 500) * 500;
      } else {
        if (state.fixedPayAmount < 100) altFixed = 100;
        else if (state.fixedPayAmount < 150) altFixed = 150;
        else if (state.fixedPayAmount < 250) altFixed = 250;
        else altFixed = Math.round(state.fixedPayAmount * 1.5 / 10) * 10;
      }

      if (altFixed > state.fixedPayAmount) {
        scenarios.push({
          id: 'alt-fixed',
          name: `Higher Fixed: ${formatMoney(altFixed)}/mo`,
          params: { principal: P, apr, strategy: 'fixed', fixedPay: altFixed },
          badge: 'badge-blue',
          badgeText: 'Faster',
          isCurrent: false
        });
      }
    } else if (state.strategy === 'duration') {
      scenarios.push({
        id: 'current-duration',
        name: `Your Choice: Target ${formatMonths(state.targetMonths)}`,
        params: { principal: P, apr, strategy: 'duration', targetMonths: state.targetMonths },
        badge: 'badge-blue',
        badgeText: 'Your Plan',
        isCurrent: true
      });

      const stdFixed = state.currency === 'THB' ? 3500 : 100;
      scenarios.push({
        id: 'bench-fixed',
        name: `Fixed ${formatMoney(stdFixed)}/mo`,
        params: { principal: P, apr, strategy: 'fixed', fixedPay: stdFixed },
        badge: 'badge-blue',
        badgeText: 'Steady',
        isCurrent: false
      });
    } else if (state.strategy !== 'promo') {
      // Current strategy is 'minimum' or 'full': show a standard fixed plan to show contrast
      const stdFixed = state.currency === 'THB' ? 3500 : 100;
      scenarios.push({
        id: 'bench-fixed',
        name: `Fixed ${formatMoney(stdFixed)}/mo`,
        params: { principal: P, apr, strategy: 'fixed', fixedPay: stdFixed },
        badge: 'badge-blue',
        badgeText: 'Steady',
        isCurrent: false
      });
    }

    // 5. Minimum Payment Only
    scenarios.push({
      id: 'minimum',
      name: `Minimum Only (${state.minPayPercent.toFixed(0)}%)`,
      params: { principal: P, apr, strategy: 'minimum', minPayPercent: state.minPayPercent },
      badge: 'badge-red',
      badgeText: 'Debt Trap 🚨',
      isCurrent: (state.strategy === 'minimum')
    });

    el.comparisonTableBody.innerHTML = '';
    scenarios.forEach(sc => {
      const res = runSimulation(sc.params);
      const tr = document.createElement('tr');
      if (sc.isCurrent) tr.className = 'highlight-row';

      tr.innerHTML = `
        <td>
          <strong>${sc.name}</strong> 
          <span class="badge-pill ${sc.badge}">${sc.badgeText}</span>
          ${sc.isCurrent ? '<small style="color: #2563eb; display:block; font-weight:700;">(Your Current Choice)</small>' : ''}
        </td>
        <td>${res.isInfinite ? 'Too Low!' : formatMoney(res.firstPayment)}</td>
        <td>${formatMonths(res.durationMonths)}</td>
        <td style="color: ${res.totalInterest > 0 ? '#dc2626' : '#16a34a'}; font-weight: 700;">
          ${res.isInfinite ? '∞' : (res.totalInterest === 0 ? formatMoney(0) : '+' + formatMoney(res.totalInterest))}
        </td>
        <td><strong>${res.isInfinite ? 'Never ends' : formatMoney(res.totalPaid)}</strong></td>
      `;
      el.comparisonTableBody.appendChild(tr);
    });
  }

  // Update 0% Promo Spotlight Card (10 Months vs 12+ Months Slip)
  function updateSpotlightCard() {
    if (!el.promoSpotlightCard) return;

    const P = state.purchaseAmount;
    const apr = state.apr;

    // Plan A: Disciplined 10 Months @ 0%
    const ontimeMonthly = P / 10;
    if (el.spotlightOntimeMonthly) el.spotlightOntimeMonthly.textContent = formatMoney(ontimeMonthly);
    if (el.spotlightOntimeTotal) el.spotlightOntimeTotal.textContent = formatMoney(P);

    // Plan B: Slipped
    const slipTarget = state.spotlightSlipTarget || '12';
    const resSlip = runSimulation({
      principal: P,
      apr,
      strategy: 'promo',
      promoMode: 'slip',
      promoSlipTarget: slipTarget,
      currency: state.currency
    });

    if (el.spotlightSlippedMonthly) el.spotlightSlippedMonthly.textContent = formatMoney(resSlip.firstPayment);
    if (el.spotlightSlippedPaymentLabel) {
      if (slipTarget === 'min') {
        el.spotlightSlippedPaymentLabel.textContent = `starts at ${formatMoney(resSlip.firstPayment)} (8% min), drops monthly`;
      } else {
        el.spotlightSlippedPaymentLabel.textContent = `per month (~${resSlip.durationMonths} months)`;
      }
    }
    if (el.spotlightSlippedNote) {
      if (slipTarget === 'min') {
        el.spotlightSlippedNote.innerHTML = `<strong>The Minimum Trap:</strong> At Month 10 you still owe ${formatMoney(resSlip.schedule[9]?.balance || 0)}! Month 11 starts compounding ${apr.toFixed(0)}% APR for 3+ years!`;
      } else {
        el.spotlightSlippedNote.innerHTML = `<strong>Month 11 Trap:</strong> 0% ends, ${apr.toFixed(0)}% BOT APR compounds on remainder for ${resSlip.durationMonths - 10} extra months!`;
      }
    }

    if (el.spotlightSlippedInterest) el.spotlightSlippedInterest.textContent = `+${formatMoney(resSlip.totalInterest)}`;
    if (el.spotlightSlippedTotal) el.spotlightSlippedTotal.textContent = formatMoney(resSlip.totalPaid);
    if (el.spotlightSlippedDuration) el.spotlightSlippedDuration.textContent = formatMonths(resSlip.durationMonths);

    const extraMonths = resSlip.durationMonths - 10;
    if (el.spotlightSlippedExtraTime) {
      el.spotlightSlippedExtraTime.textContent = `+${extraMonths} extra month${extraMonths > 1 ? 's' : ''}`;
    }

    // Sync pills
    if (el.spotlightSlipPills) {
      el.spotlightSlipPills.forEach(pill => {
        pill.classList.toggle('active', pill.dataset.slip === slipTarget);
      });
    }

    // Difference bar
    if (el.spotlightDiffContent) {
      const extraTimeText = extraMonths === 1 ? '1 extra month' : `${extraMonths} extra months`;
      el.spotlightDiffContent.innerHTML = `
        Slipping to ${formatMonths(resSlip.durationMonths)} adds <strong>+${extraTimeText} of debt</strong> and <strong>+${formatMoney(resSlip.totalInterest)} in bank interest</strong> compared to the 10-month on-time plan!
      `;
    }
  }

  // Update Dynamic Text and Banners
  function updateDynamicTexts() {
    const curUnit = getCurrencyWord();
    
    // Full pay banner
    if (el.fullPaySuccessBanner) {
      el.fullPaySuccessBanner.innerHTML = `
        🌟 <strong>The Pro Strategy:</strong> Paying the full balance within the 45-day grace period means <strong>0 interest</strong>. You enjoy card protections and rewards without giving a single ${curUnit} of interest to the bank!
      `;
    }

    // Minimum payment hint
    if (el.minPayHint) {
      const minFloorText = state.currency === 'THB' ? 'min ฿500' : 'min $25';
      el.minPayHint.textContent = `Thai banks require 8%–10% minimum (${minFloorText}). As your balance shrinks, your minimum payment shrinks, dragging the loan out for years!`;
    }

    // Promo on-time banner
    if (el.promoOnTimeAmountDisplay) {
      el.promoOnTimeAmountDisplay.textContent = formatMoney(state.purchaseAmount / 10);
    }
    if (el.promoSlipStrategyHint) {
      el.promoSlipStrategyHint.innerHTML = `
        Months 1–10: 0% promotional APR. At <strong>Month 11</strong>, the promotion expires! The bank charges standard <strong>${state.apr.toFixed(1)}% APR</strong> on your remaining balance.
      `;
    }
  }

  // Update All Calculations & UI
  function updateAll() {
    updateDynamicTexts();

    // 1. Sync labels & inputs
    el.currencyPrefix.textContent = state.currency === 'THB' ? '฿' : '$';
    el.purchaseAmountDisplay.textContent = formatMoney(state.purchaseAmount);
    el.aprDisplay.textContent = state.strategy === 'promo' ? '0% (16% Revert)' : state.apr.toFixed(1) + '%';
    el.minPayPercentDisplay.textContent = state.minPayPercent.toFixed(1) + '%';
    el.fixedPayAmountDisplay.textContent = formatMoney(state.fixedPayAmount);
    el.targetMonthsDisplay.textContent = state.targetMonths >= 12 
      ? `${state.targetMonths} months (${formatMonths(state.targetMonths)})` 
      : `${state.targetMonths} months`;

    // Sync APR rate preset buttons active class
    el.rateBtns.forEach(b => {
      const r = parseFloat(b.dataset.rate);
      if (state.strategy === 'promo') {
        b.classList.toggle('active', r === 0);
      } else {
        b.classList.toggle('active', r === state.apr);
      }
    });

    // Sync quick fixed buttons active class
    el.quickFixedBtns.forEach(btn => {
      const val = state.currency === 'THB' ? Number(btn.dataset.fixedThb) : Number(btn.dataset.fixedUsd);
      btn.classList.toggle('active', state.strategy === 'fixed' && val === state.fixedPayAmount);
    });

    // Sync promo slip buttons active class
    if (el.promoSlipQuickBtns) {
      el.promoSlipQuickBtns.forEach(btn => {
        btn.classList.toggle('active', state.strategy === 'promo' && state.promoMode === 'slip' && btn.dataset.promoSlip === state.promoSlipTarget);
      });
    }

    // 2. Run active simulation
    const result = runSimulation({
      principal: state.purchaseAmount,
      apr: state.apr,
      strategy: state.strategy,
      minPayPercent: state.minPayPercent,
      fixedPay: state.fixedPayAmount,
      targetMonths: state.targetMonths,
      promoMode: state.promoMode,
      promoSlipTarget: state.promoSlipTarget,
      currency: state.currency
    });

    const curUnit = getCurrencyWord();

    // 3. Render Top Metrics
    if (result.isInfinite) {
      el.resTotalPaid.textContent = 'Infinite Debt';
      el.resOriginalPrice.textContent = `Original price: ${formatMoney(state.purchaseAmount)}`;
      el.resTotalInterest.textContent = 'Never-ending';
      el.resInterestPercent.textContent = 'Interest > Monthly Payment';
      el.resDuration.textContent = 'Never!';
      if (el.resTimeSub) el.resTimeSub.textContent = 'Indefinite debt (never ends)';
      el.resFirstPayment.textContent = formatMoney(result.firstPayment);
      el.resPaymentNote.textContent = 'Payment is lower than interest!';

      // Alert
      el.realityAlertBox.className = 'alert-box danger';
      el.alertIcon.textContent = '🚨';
      el.alertTitle.textContent = 'DANGER: Negative Amortization / Infinite Debt!';
      el.alertDescription.textContent = `Your chosen monthly payment is smaller than or equal to the monthly interest charged by the bank. Your balance will grow every single month without ever being paid off!`;

      // Breakdown bar
      el.barPrincipal.style.width = '20%';
      el.barInterest.style.width = '80%';
      el.breakdownRatio.textContent = 'Debt compounding out of control';
      return;
    }

    el.resTotalPaid.textContent = formatMoney(result.totalPaid);
    el.resOriginalPrice.textContent = `Original price: ${formatMoney(state.purchaseAmount)}`;
    el.resTotalInterest.textContent = result.totalInterest > 0 ? `+${formatMoney(result.totalInterest)}` : formatMoney(0);

    const interestPercentOverPrice = ((result.totalInterest / state.purchaseAmount) * 100).toFixed(1);
    el.resInterestPercent.textContent = result.totalInterest > 0 ? `+${interestPercentOverPrice}% on top of price` : '0% extra (smart buyer!)';

    el.resDuration.textContent = formatMonths(result.durationMonths);
    if (el.resTimeSub) {
      if (result.durationMonths <= 1) {
        el.resTimeSub.textContent = 'Immediate full settlement';
      } else {
        el.resTimeSub.textContent = `${result.durationMonths} monthly billing cycles`;
      }
    }

    el.resFirstPayment.textContent = `${formatMoney(result.firstPayment)} / month`;
    const firstMonthInterest = state.purchaseAmount * ((state.apr / 100) / 12);
    if (state.strategy === 'promo' && result.schedule[0]?.isPromoActive) {
      el.resPaymentNote.textContent = 'Month 1 is 0% interest (promotional grace)';
    } else {
      el.resPaymentNote.textContent = `Month 1 gives ${formatMoney(firstMonthInterest)} straight to bank profit`;
    }

    // 4. Breakdown Bar
    const principalPercent = Math.max(10, Math.min(100, Math.round((state.purchaseAmount / result.totalPaid) * 100)));
    const interestPercent = 100 - principalPercent;
    el.barPrincipal.style.width = `${principalPercent}%`;
    el.barInterest.style.width = `${interestPercent}%`;
    el.breakdownRatio.textContent = `${principalPercent}% Laptop / ${interestPercent}% Bank Interest`;

    // 5. Reality Check Alert Box logic
    if (state.strategy === 'promo' && state.promoMode === 'ontime') {
      el.realityAlertBox.className = 'alert-box success';
      el.alertIcon.textContent = '🏆';
      el.alertTitle.textContent = 'Mall 0% 10-Month Master: Zero Interest Paid!';
      el.alertDescription.textContent = `By paying the required monthly installment (${formatMoney(state.purchaseAmount / 10)}/mo), you clear the entire balance within 10 months. You enjoy the promotion with zero interest donated to the bank!`;
    } else if (state.strategy === 'promo' && state.promoMode === 'slip') {
      el.realityAlertBox.className = 'alert-box danger';
      el.alertIcon.textContent = '⚠️';
      el.alertTitle.textContent = 'The 0% Promo Trap: Debt Slipped Past Month 10!';
      el.alertDescription.textContent = `Because payments were reduced below the 10-month schedule, you crossed into Month 11! The 0% promo shield expired, and the bank is now taking ${state.apr.toFixed(1)}% APR on your remaining debt.`;
    } else if (state.strategy === 'full' || result.totalInterest === 0) {
      el.realityAlertBox.className = 'alert-box success';
      el.alertIcon.textContent = '🏆';
      el.alertTitle.textContent = 'Credit Card Master: Zero Interest Paid!';
      el.alertDescription.textContent = `By paying your full balance each statement cycle, you take advantage of the grace period. You get card benefits and convenience without paying a single ${curUnit} in interest fees.`;
    } else if (result.durationMonths > 60 || interestPercentOverPrice > 50) {
      el.realityAlertBox.className = 'alert-box danger';
      el.alertIcon.textContent = '⚠️';
      el.alertTitle.textContent = 'Critical Debt Warning: The Bank Wins Big!';
      el.alertDescription.textContent = `You are paying +${interestPercentOverPrice}% extra in interest fees, and it will take ${formatMonths(result.durationMonths)} to pay off. The laptop will likely be slow or broken before you finish paying for it!`;
    } else if (state.strategy === 'minimum') {
      el.realityAlertBox.className = 'alert-box';
      el.alertIcon.textContent = '📉';
      el.alertTitle.textContent = 'The Minimum Payment Trap';
      el.alertDescription.textContent = `Because minimum payments shrink as your balance decreases, the principal pays down at a crawl. Increasing your payment by even a small amount cuts months or years off this timeline.`;
    } else {
      el.realityAlertBox.className = 'alert-box';
      el.alertIcon.textContent = '💡';
      el.alertTitle.textContent = 'Fixed Payment Momentum';
      el.alertDescription.textContent = `Maintaining a steady monthly payment accelerates payoff as more of each payment goes toward the principal instead of interest.`;
    }

    // 6. Opportunity Cost
    updateOpportunityCost(result.totalInterest);

    // 7. Spotlight Card
    updateSpotlightCard();

    // 8. Comparison Table
    renderComparisonTable(result);

    // 9. SVG Chart & Month Detail Box
    renderChart(result.schedule, state.purchaseAmount);
  }

  // Switch Currency (Exposed to window for flexibility)
  function setCurrency(newCur) {
    if (newCur !== 'USD' && newCur !== 'THB') return;
    if (state.currency === newCur) return;

    if (newCur === 'THB') {
      state.currency = 'THB';
      state.purchaseAmount = Math.round(state.purchaseAmount * state.exchangeRate);
      state.fixedPayAmount = Math.round(state.fixedPayAmount * state.exchangeRate);
      
      el.currencyPrefix.textContent = '฿';
      
      el.purchaseAmount.min = 500;
      el.purchaseAmount.max = 2000000;
      el.purchaseAmount.step = 500;
      el.purchaseAmount.value = state.purchaseAmount;

      el.fixedPayAmount.min = 500;
      el.fixedPayAmount.max = 20000;
      el.fixedPayAmount.step = 250;
      el.fixedPayAmount.value = state.fixedPayAmount;
    } else {
      state.currency = 'USD';
      state.purchaseAmount = Math.round(state.purchaseAmount / state.exchangeRate);
      state.fixedPayAmount = Math.max(20, Math.round(state.fixedPayAmount / state.exchangeRate));

      el.currencyPrefix.textContent = '$';

      el.purchaseAmount.min = 10;
      el.purchaseAmount.max = 50000;
      el.purchaseAmount.step = 10;
      el.purchaseAmount.value = state.purchaseAmount;

      el.fixedPayAmount.min = 20;
      el.fixedPayAmount.max = 500;
      el.fixedPayAmount.step = 5;
      el.fixedPayAmount.value = state.fixedPayAmount;
    }

    // Update fixed pill button labels
    el.quickFixedBtns.forEach(btn => {
      const amt = state.currency === 'THB' ? btn.dataset.fixedThb : btn.dataset.fixedUsd;
      btn.textContent = formatMoney(Number(amt)) + '/mo';
    });

    updateAll();
  }

  // Expose currency switcher function globally for quick testing / future use
  window.setSimCurrency = setCurrency;

  // Switch Strategy View Sub-Panels
  function setStrategy(newStrat) {
    state.strategy = newStrat;
    el.minPayOptions.classList.toggle('hidden', newStrat !== 'minimum');
    el.fixedPayOptions.classList.toggle('hidden', newStrat !== 'fixed');
    el.durationPayOptions.classList.toggle('hidden', newStrat !== 'duration');
    if (el.promoPayOptions) el.promoPayOptions.classList.toggle('hidden', newStrat !== 'promo');
    el.fullPayOptions.classList.toggle('hidden', newStrat !== 'full');
    updateAll();
  }

  // Event Listeners
  function initEvents() {
    // Promo Mode toggle buttons (inside strategy panel)
    if (el.btnPromoModeOntime && el.btnPromoModeSlip) {
      el.btnPromoModeOntime.addEventListener('click', () => {
        state.promoMode = 'ontime';
        el.btnPromoModeOntime.classList.add('active');
        el.btnPromoModeSlip.classList.remove('active');
        el.promoOnTimeSubView.classList.remove('hidden');
        el.promoSlipSubView.classList.add('hidden');
        updateAll();
      });

      el.btnPromoModeSlip.addEventListener('click', () => {
        state.promoMode = 'slip';
        el.btnPromoModeOntime.classList.remove('active');
        el.btnPromoModeSlip.classList.add('active');
        el.promoOnTimeSubView.classList.add('hidden');
        el.promoSlipSubView.classList.remove('hidden');
        updateAll();
      });
    }

    // Promo Slip Quick Pill Buttons in Strategy Panel
    if (el.promoSlipQuickBtns) {
      el.promoSlipQuickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          state.promoSlipTarget = btn.dataset.promoSlip;
          updateAll();
        });
      });
    }

    // Spotlight Slip Pill Buttons
    if (el.spotlightSlipPills) {
      el.spotlightSlipPills.forEach(pill => {
        pill.addEventListener('click', () => {
          state.spotlightSlipTarget = pill.dataset.slip;
          updateSpotlightCard();
        });
      });
    }

    // Spotlight Action: Simulate On-Time in Chart
    if (el.btnSimulateOntime) {
      el.btnSimulateOntime.addEventListener('click', () => {
        const promoRadio = document.querySelector('input[name="payStrategy"][value="promo"]');
        if (promoRadio) promoRadio.checked = true;
        state.strategy = 'promo';
        state.promoMode = 'ontime';
        if (el.btnPromoModeOntime) el.btnPromoModeOntime.classList.add('active');
        if (el.btnPromoModeSlip) el.btnPromoModeSlip.classList.remove('active');
        if (el.promoOnTimeSubView) el.promoOnTimeSubView.classList.remove('hidden');
        if (el.promoSlipSubView) el.promoSlipSubView.classList.add('hidden');
        setStrategy('promo');
        if (el.amortizationSection) el.amortizationSection.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Spotlight Action: Simulate Slipped in Chart
    if (el.btnSimulateSlipped) {
      el.btnSimulateSlipped.addEventListener('click', () => {
        const promoRadio = document.querySelector('input[name="payStrategy"][value="promo"]');
        if (promoRadio) promoRadio.checked = true;
        state.strategy = 'promo';
        state.promoMode = 'slip';
        state.promoSlipTarget = state.spotlightSlipTarget || '12';
        if (el.btnPromoModeOntime) el.btnPromoModeOntime.classList.remove('active');
        if (el.btnPromoModeSlip) el.btnPromoModeSlip.classList.add('active');
        if (el.promoOnTimeSubView) el.promoOnTimeSubView.classList.add('hidden');
        if (el.promoSlipSubView) el.promoSlipSubView.classList.remove('hidden');
        setStrategy('promo');
        if (el.amortizationSection) el.amortizationSection.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Purchase Amount input
    el.purchaseAmount.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        state.purchaseAmount = val;
        // deactivate chip highlighting
        el.presetChips.forEach(c => c.classList.remove('active'));
        updateAll();
      }
    });

    // Preset purchase chips
    el.presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        el.presetChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const val = state.currency === 'THB' ? Number(chip.dataset.presetThb) : Number(chip.dataset.presetUsd);
        state.purchaseAmount = val;
        el.purchaseAmount.value = val;
        updateAll();
      });
    });

    // APR Preset Buttons
    el.rateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = parseFloat(btn.dataset.rate);
        if (rate === 0) {
          // Select 0% 10-Mo Promo strategy
          const promoRadio = document.querySelector('input[name="payStrategy"][value="promo"]');
          if (promoRadio) {
            promoRadio.checked = true;
            setStrategy('promo');
          }
        } else {
          state.apr = rate;
          if (state.strategy === 'promo') {
            // When leaving 0% promo to choose a card APR, switch to minimum payment
            const minRadio = document.querySelector('input[name="payStrategy"][value="minimum"]');
            if (minRadio) {
              minRadio.checked = true;
              setStrategy('minimum');
            } else {
              updateAll();
            }
          } else {
            updateAll();
          }
        }
      });
    });

    // Repayment Strategy Radios
    el.strategyRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          setStrategy(e.target.value);
        }
      });
    });

    // Minimum Payment % slider
    el.minPayPercent.addEventListener('input', (e) => {
      state.minPayPercent = parseFloat(e.target.value);
      updateAll();
    });

    // Fixed Payment Amount slider
    el.fixedPayAmount.addEventListener('input', (e) => {
      state.fixedPayAmount = parseFloat(e.target.value);
      updateAll();
    });

    // Quick Fixed Buttons
    el.quickFixedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = state.currency === 'THB' ? Number(btn.dataset.fixedThb) : Number(btn.dataset.fixedUsd);
        state.fixedPayAmount = val;
        el.fixedPayAmount.value = val;
        updateAll();
      });
    });

    // Target Duration slider
    el.targetMonths.addEventListener('input', (e) => {
      state.targetMonths = parseInt(e.target.value, 10);
      updateAll();
    });

    // Chart Touch / Pointer Scrubbing (iPad & Mobile Friendly)
    let isPointerDragging = false;

    function scrubChart(e) {
      if (!state.currentSchedule || state.currentSchedule.length === 0) return;
      const rect = el.chartContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const padLeft = 60;
      const padRight = 35;
      const plotWidth = rect.width - padLeft - padRight;
      if (plotWidth <= 0) return;

      const relX = Math.max(0, Math.min(plotWidth, x - padLeft));
      const totalMonths = state.currentSchedule.length;
      const idx = Math.min(totalMonths - 1, Math.max(0, Math.floor((relX / plotWidth) * totalMonths)));

      updateMonthDetail(idx);
    }

    if (el.chartContainer) {
      el.chartContainer.addEventListener('pointerdown', (e) => {
        isPointerDragging = true;
        try {
          el.chartContainer.setPointerCapture(e.pointerId);
        } catch (err) {}
        scrubChart(e);
      });

      el.chartContainer.addEventListener('pointermove', (e) => {
        if (isPointerDragging) {
          scrubChart(e);
        }
      });

      const stopDragging = (e) => {
        if (isPointerDragging) {
          isPointerDragging = false;
          try {
            el.chartContainer.releasePointerCapture(e.pointerId);
          } catch (err) {}
        }
      };

      el.chartContainer.addEventListener('pointerup', stopDragging);
      el.chartContainer.addEventListener('pointercancel', stopDragging);
      el.chartContainer.addEventListener('lostpointercapture', stopDragging);

      // Also support direct click or tap on bar
      el.balanceChart.addEventListener('click', (e) => {
        const group = e.target.closest('.bar-group');
        if (group) {
          const idx = parseInt(group.dataset.idx, 10);
          if (!isNaN(idx)) updateMonthDetail(idx);
        }
      });
    }

    // Keyboard arrow keys accessibility for scrubbing months
    window.addEventListener('keydown', (e) => {
      if (!state.currentSchedule || state.currentSchedule.length === 0) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'BUTTON')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        updateMonthDetail(state.selectedMonthIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        updateMonthDetail(state.selectedMonthIndex - 1);
      }
    });
  }

  // Initialize
  initEvents();
  // Ensure correct input limits for initial currency
  if (state.currency === 'THB') {
    el.purchaseAmount.min = 500;
    el.purchaseAmount.max = 2000000;
    el.purchaseAmount.step = 500;
    el.purchaseAmount.value = state.purchaseAmount;

    el.fixedPayAmount.min = 500;
    el.fixedPayAmount.max = 20000;
    el.fixedPayAmount.step = 250;
    el.fixedPayAmount.value = state.fixedPayAmount;
  }
  updateAll();
})();
