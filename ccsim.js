/**
 * Credit Card Reality Simulator (ccsim.js)
 * Personal Finance Education Lab for High School Students
 * Mobile & Tablet First • Declarative UI Controller powered by CCSim Core Engine
 */

(function () {
  'use strict';

  if (!window.CCSim) {
    console.error('CCSim core engine not loaded.');
    return;
  }

  // Read optional URL parameter: e.g. ccsim.html?currency=USD
  const urlParams = new URLSearchParams(window.location.search);
  const initialCurrency = urlParams.get('currency')?.toUpperCase() === 'USD' ? 'USD' : 'THB';

  // Immutable Application State / Context
  let context = window.CCSim.createInitialContext({ currency: initialCurrency });

  // DOM Elements cache
  const el = {
    // Currency Toggle
    curBtns: document.querySelectorAll('.currency-toggle .cur-btn'),
    currencyPrefix: document.getElementById('currencyPrefix'),

    // Sticky Summary Bar (Mobile / Tablet)
    stickyOriginalPrice: document.getElementById('stickyOriginalPrice'),
    stickyTotalPaid: document.getElementById('stickyTotalPaid'),
    stickyTotalInterest: document.getElementById('stickyTotalInterest'),
    stickyFreedomDate: document.getElementById('stickyFreedomDate'),
    stickyDuration: document.getElementById('stickyDuration'),

    // Step 1: Purchase Inputs
    presetChips: document.querySelectorAll('.preset-chips .chip'),
    purchaseAmount: document.getElementById('purchaseAmount'),
    purchaseAmountDisplay: document.getElementById('purchaseAmountDisplay'),

    // Step 2: Payment Habits
    habitCards: document.querySelectorAll('.habit-card'),
    strategyRadios: document.querySelectorAll('input[name="payStrategy"]'),
    minPayOptions: document.getElementById('minPayOptions'),
    fixedPayOptions: document.getElementById('fixedPayOptions'),
    fullPayOptions: document.getElementById('fullPayOptions'),
    promoPayOptions: document.getElementById('promoPayOptions'),

    minPayPercent: document.getElementById('minPayPercent'),
    minPayPercentDisplay: document.getElementById('minPayPercentDisplay'),
    minPayHint: document.getElementById('minPayHint'),

    fixedPayAmount: document.getElementById('fixedPayAmount'),
    fixedPayAmountDisplay: document.getElementById('fixedPayAmountDisplay'),
    quickFixedBtns: document.querySelectorAll('.quick-fixed-btns .pill-btn'),

    fullPaySuccessBanner: document.getElementById('fullPaySuccessBanner'),

    promoScenBtns: document.querySelectorAll('.promo-scen-btn'),
    promoScenarioBanner: document.getElementById('promoScenarioBanner'),

    // Step 3: Reality 1 (Price Tag)
    resOriginalPrice: document.getElementById('resOriginalPrice'),
    resTotalInterest: document.getElementById('resTotalInterest'),
    resTotalPaid: document.getElementById('resTotalPaid'),
    markupPercentTag: document.getElementById('markupPercentTag'),
    barPrincipal: document.getElementById('barPrincipal'),
    barInterest: document.getElementById('barInterest'),
    barPrincipalLabel: document.getElementById('barPrincipalLabel'),
    barInterestLabel: document.getElementById('barInterestLabel'),
    oppSummaryText: document.getElementById('oppSummaryText'),

    // Step 3: Reality 2 (Horizon & Paycheck Drain)
    freedomDurationTag: document.getElementById('freedomDurationTag'),
    resFreedomDate: document.getElementById('resFreedomDate'),
    resFreedomSub: document.getElementById('resFreedomSub'),
    productAgeWarning: document.getElementById('productAgeWarning'),
    warningItemNames: document.querySelectorAll('.warning-item-name'),
    sliceDebtBar: document.getElementById('sliceDebtBar'),
    sliceDebtLabel: document.getElementById('sliceDebtLabel'),
    sliceLivingBar: document.getElementById('sliceLivingBar'),
    sliceLivingLabel: document.getElementById('sliceLivingLabel'),
    paycheckDebtPercent: document.getElementById('paycheckDebtPercent'),

    // Step 3: Reality 3 (The Treadmill)
    splitTotalPayment: document.getElementById('splitTotalPayment'),
    splitPrincipalPaid: document.getElementById('splitPrincipalPaid'),
    splitInterestPaid: document.getElementById('splitInterestPaid'),

    // Step 3: Reality 4 (The Antidote)
    antidoteMinTime: document.getElementById('antidoteMinTime'),
    antidoteMinInterest: document.getElementById('antidoteMinInterest'),
    antidoteFixedTime: document.getElementById('antidoteFixedTime'),
    antidoteFixedInterest: document.getElementById('antidoteFixedInterest'),

    // Step 4: Deep Dive Tools
    aprDisplay: document.getElementById('aprDisplay'),
    rateBtns: document.querySelectorAll('.rate-btn'),
    balanceChart: document.getElementById('balanceChart'),
    chartContainer: document.getElementById('chartContainer'),
    chartMidMonth: document.getElementById('chartMidMonth'),
    chartEndMonth: document.getElementById('chartEndMonth'),
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
    detailRemainingMonths: document.getElementById('detailRemainingMonths'),

    comparisonTableBody: document.getElementById('comparisonTableBody'),
    oppInterestAmount: document.getElementById('oppInterestAmount'),
    oppItemsGrid: document.getElementById('oppItemsGrid')
  };

  // =========================================================================
  // Pure State Dispatcher
  // =========================================================================
  function dispatch(action) {
    context = window.CCSim.reduce(context, action);
    render();
  }

  // =========================================================================
  // Render: Declarative View Update
  // =========================================================================
  function render() {
    const vm = window.CCSim.computeViewModel(context);
    const { formatMoney, formatMonths } = window.CCSim;
    const cur = context.currency;

    // 1. Currency & Inputs Synchronization
    if (el.currencyPrefix) el.currencyPrefix.textContent = cur === 'THB' ? '฿' : '$';
    if (el.purchaseAmountDisplay) el.purchaseAmountDisplay.textContent = formatMoney(context.purchaseAmount, cur);

    // Sync input control attributes to currency bounds
    const curConfig = window.CCSim.CURRENCY_CONFIG[cur];
    if (el.purchaseAmount) {
      el.purchaseAmount.min = curConfig.minPurchase;
      el.purchaseAmount.max = curConfig.maxPurchase;
      el.purchaseAmount.step = curConfig.stepPurchase;
      if (document.activeElement !== el.purchaseAmount) {
        el.purchaseAmount.value = context.purchaseAmount;
      }
    }

    if (el.fixedPayAmount) {
      el.fixedPayAmount.min = curConfig.minFixed;
      el.fixedPayAmount.max = curConfig.maxFixed;
      el.fixedPayAmount.step = curConfig.stepFixed;
      if (document.activeElement !== el.fixedPayAmount) {
        el.fixedPayAmount.value = context.fixedPayAmount;
      }
    }

    if (el.minPayPercent && document.activeElement !== el.minPayPercent) {
      el.minPayPercent.value = context.minPayPercent;
    }

    // Currency toggle buttons
    el.curBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cur === cur);
    });

    // Preset chips
    el.presetChips.forEach(chip => {
      const price = cur === 'THB' ? Number(chip.dataset.presetThb) : Number(chip.dataset.presetUsd);
      const priceSpan = chip.querySelector('.chip-price');
      if (priceSpan) priceSpan.textContent = formatMoney(price, cur);
      const isPresetActive = price === context.purchaseAmount && (chip.dataset.itemName || '') === context.itemName;
      chip.classList.toggle('active', isPresetActive);
    });

    // Habit Cards & Strategy Selection
    el.habitCards.forEach(card => {
      const radio = card.querySelector('input[name="payStrategy"]');
      const isSelected = (radio.value === context.strategy);
      radio.checked = isSelected;
      card.classList.toggle('active', isSelected);
    });

    // Sub-Panels
    if (el.minPayOptions) el.minPayOptions.classList.toggle('hidden', context.strategy !== 'minimum');
    if (el.fixedPayOptions) el.fixedPayOptions.classList.toggle('hidden', context.strategy !== 'fixed');
    if (el.fullPayOptions) el.fullPayOptions.classList.toggle('hidden', context.strategy !== 'full');
    if (el.promoPayOptions) el.promoPayOptions.classList.toggle('hidden', context.strategy !== 'promo');

    // Promo scenario selector buttons & banner
    if (el.promoScenBtns) {
      el.promoScenBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.promoScen === context.promoScenario);
      });
    }
    if (el.promoScenarioBanner) {
      el.promoScenarioBanner.className = `promo-scenario-banner ${context.promoScenario}-banner`;
      el.promoScenarioBanner.innerHTML = vm.promoBannerHtml;
    }

    // Displays
    if (el.aprDisplay) el.aprDisplay.textContent = context.apr.toFixed(1) + '%';
    if (el.minPayPercentDisplay) el.minPayPercentDisplay.textContent = context.minPayPercent.toFixed(1) + '%';
    if (el.fixedPayAmountDisplay) el.fixedPayAmountDisplay.textContent = formatMoney(context.fixedPayAmount, cur) + '/mo';

    // Rate buttons (Deep Dive)
    if (el.rateBtns) {
      el.rateBtns.forEach(b => {
        b.classList.toggle('active', parseFloat(b.dataset.rate) === context.apr);
      });
    }

    // Quick fixed pills
    if (el.quickFixedBtns) {
      el.quickFixedBtns.forEach(btn => {
        const val = cur === 'THB' ? Number(btn.dataset.fixedThb) : Number(btn.dataset.fixedUsd);
        btn.textContent = formatMoney(val, cur) + '/mo';
        btn.classList.toggle('active', context.strategy === 'fixed' && val === context.fixedPayAmount);
      });
    }

    // Warning item names
    if (el.warningItemNames) {
      el.warningItemNames.forEach(span => {
        span.textContent = context.itemName.toLowerCase();
      });
    }

    // 2. Sticky Summary Bar
    const sim = vm.currentSim;
    if (el.stickyOriginalPrice) el.stickyOriginalPrice.textContent = formatMoney(context.purchaseAmount, cur);
    if (el.stickyTotalPaid) el.stickyTotalPaid.textContent = formatMoney(sim.totalPaid, cur);
    if (el.stickyTotalInterest) {
      el.stickyTotalInterest.textContent = sim.totalInterest > 0
        ? `+${formatMoney(sim.totalInterest, cur)} extra`
        : (cur === 'THB' ? '฿0 interest' : '$0 interest');
      el.stickyTotalInterest.className = sim.totalInterest > 0 ? 'sticky-sub danger-text' : 'sticky-sub green-text';
    }
    if (el.stickyFreedomDate) el.stickyFreedomDate.textContent = vm.freedomDateStr;
    if (el.stickyDuration) el.stickyDuration.textContent = vm.durationMonthsFormatted;

    // 3. Reality 1: True Price Tag
    if (el.resOriginalPrice) el.resOriginalPrice.textContent = formatMoney(context.purchaseAmount, cur);
    if (el.resTotalPaid) el.resTotalPaid.textContent = formatMoney(sim.totalPaid, cur);
    if (el.resTotalInterest) {
      el.resTotalInterest.textContent = sim.totalInterest > 0
        ? `+${formatMoney(sim.totalInterest, cur)}`
        : formatMoney(0, cur);
      el.resTotalInterest.className = sim.totalInterest > 0 ? 'danger-text' : 'green-text';
    }
    if (el.markupPercentTag) {
      if (sim.totalInterest > 0) {
        el.markupPercentTag.textContent = `+${vm.markupPct}% Impatience Tax`;
        el.markupPercentTag.className = 'reality-tag danger-tag';
      } else {
        el.markupPercentTag.textContent = '0% Extra (Smart!)';
        el.markupPercentTag.className = 'reality-tag hero-tag';
      }
    }

    if (el.barPrincipal) el.barPrincipal.style.width = `${vm.costRatio.principalPct}%`;
    if (el.barInterest) el.barInterest.style.width = `${vm.costRatio.interestPct}%`;
    if (el.barPrincipalLabel) el.barPrincipalLabel.textContent = `Item: ${formatMoney(context.purchaseAmount, cur)} (${vm.costRatio.principalPct}%)`;
    if (el.barInterestLabel) el.barInterestLabel.textContent = `Bank Interest: ${formatMoney(sim.totalInterest, cur)} (${vm.costRatio.interestPct}%)`;

    // 4. Reality 2: Horizon & Paycheck Drain
    if (el.freedomDurationTag) el.freedomDurationTag.textContent = vm.durationMonthsFormatted;
    if (el.resFreedomDate) el.resFreedomDate.textContent = vm.freedomDateStr;
    if (el.resFreedomSub) {
      if (sim.durationMonths <= 1) {
        el.resFreedomSub.innerHTML = '<strong>Immediate settlement:</strong> You leave zero debt behind!';
      } else {
        el.resFreedomSub.innerHTML = `That's <strong>${vm.durationMonthsFormatted}</strong> (${sim.durationMonths} monthly billing cycles) of debt!`;
      }
    }

    if (el.productAgeWarning) {
      if (!vm.productAgeWarning.show) {
        el.productAgeWarning.style.display = 'none';
      } else {
        el.productAgeWarning.style.display = 'block';
        el.productAgeWarning.innerHTML = `⚠️ <strong>Product Life Reality:</strong> By ${vm.productAgeWarning.year}, your ${vm.productAgeWarning.itemName.toLowerCase()} will likely be slow, scratched, or outdated—yet you will <em>still</em> be paying the bank for it every month!`;
      }
    }

    const drain = vm.paycheckDrain;
    if (el.sliceDebtBar) el.sliceDebtBar.style.width = `${drain.debtPct}%`;
    if (el.sliceLivingBar) el.sliceLivingBar.style.width = `${drain.livingPct}%`;
    if (el.sliceDebtLabel) el.sliceDebtLabel.textContent = `${formatMoney(drain.firstPayment, cur)} Debt (${drain.debtPct}%)`;
    if (el.sliceLivingLabel) el.sliceLivingLabel.textContent = `${formatMoney(drain.livingAmount, cur)} Left for Food & Life`;
    if (el.paycheckDebtPercent) el.paycheckDebtPercent.textContent = `${drain.debtPct}% Eaten by Debt`;

    // 5. Reality 3: Minimum Treadmill Breakdown
    const split = vm.firstMonthSplit;
    if (el.splitTotalPayment) el.splitTotalPayment.textContent = formatMoney(split.totalPayment, cur);
    if (el.splitPrincipalPaid) el.splitPrincipalPaid.textContent = formatMoney(split.principalPaid, cur);
    if (el.splitInterestPaid) {
      el.splitInterestPaid.textContent = formatMoney(split.interestPaid, cur);
      el.splitInterestPaid.className = split.interestPaid > 0 ? 'split-col-val danger-text' : 'split-col-val green-text';
    }

    // 6. Reality 4: The Antidote
    if (el.antidoteMinTime) el.antidoteMinTime.textContent = formatMonths(vm.minBenchmark.durationMonths);
    if (el.antidoteMinInterest) el.antidoteMinInterest.textContent = `+${formatMoney(vm.minBenchmark.totalInterest, cur)} interest`;
    if (el.antidoteFixedTime) el.antidoteFixedTime.textContent = formatMonths(vm.fixedBenchmark.durationMonths);
    if (el.antidoteFixedInterest) el.antidoteFixedInterest.textContent = `+${formatMoney(vm.fixedBenchmark.totalInterest, cur)} interest`;

    // 7. Opportunity Cost
    if (el.oppInterestAmount) el.oppInterestAmount.textContent = formatMoney(sim.totalInterest, cur);
    if (el.oppSummaryText) el.oppSummaryText.innerHTML = vm.oppCost.summaryHtml;
    if (el.oppItemsGrid) {
      el.oppItemsGrid.innerHTML = '';
      const validItems = vm.oppCost.items.filter(it => it.count > 0);
      if (validItems.length === 0) {
        el.oppItemsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem;">
            🎉 0 interest wasted! You paid off your card without donating money to the bank.
          </div>
        `;
      } else {
        validItems.forEach(item => {
          const card = document.createElement('div');
          card.className = 'opp-item';
          card.innerHTML = `
            <div class="opp-item-icon">${item.icon}</div>
            <div class="opp-item-count">${item.count.toLocaleString()}</div>
            <div class="opp-item-name">${item.name}</div>
          `;
          el.oppItemsGrid.appendChild(card);
        });
      }
    }

    // 8. Comparison Table
    if (el.comparisonTableBody) {
      el.comparisonTableBody.innerHTML = '';
      vm.comparisonScenarios.forEach(sc => {
        const tr = document.createElement('tr');
        if (sc.isCurrent) tr.className = 'highlight-row';
        const res = sc.result;

        tr.innerHTML = `
          <td>
            <strong>${sc.name}</strong> 
            <span class="badge-pill ${sc.badge}">${sc.badgeText}</span>
            ${sc.isCurrent ? '<small style="color: #2563eb; display:block; font-weight:700;">(Your Active Selection)</small>' : ''}
          </td>
          <td>${res.isInfinite ? 'Too Low!' : formatMoney(res.firstPayment, cur)}</td>
          <td>${formatMonths(res.durationMonths)}</td>
          <td style="color: ${res.totalInterest > 0 ? '#dc2626' : '#16a34a'}; font-weight: 700;">
            ${res.isInfinite ? '∞' : (res.totalInterest === 0 ? formatMoney(0, cur) : '+' + formatMoney(res.totalInterest, cur))}
          </td>
          <td><strong>${res.isInfinite ? 'Never ends' : formatMoney(res.totalPaid, cur)}</strong></td>
        `;
        el.comparisonTableBody.appendChild(tr);
      });
    }

    // 9. SVG Balance & Debt Chart & Month Detail
    renderChart(sim.schedule, context.purchaseAmount, vm.monthDetail);
  }

  // =========================================================================
  // Render SVG Chart & Month Inspector
  // =========================================================================
  function renderChart(schedule, initialPrincipal, monthDetail) {
    const svg = el.balanceChart;
    if (!svg) return;
    const { formatMoney, formatMonths } = window.CCSim;
    const cur = context.currency;

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

    const totalMonths = schedule.length;
    const midMonth = Math.max(1, Math.round(totalMonths / 2));
    if (el.chartMidMonth) el.chartMidMonth.textContent = formatMonths(midMonth);
    if (el.chartEndMonth) el.chartEndMonth.textContent = `${formatMonths(totalMonths)} (Debt-Free 🎉)`;

    const remainingInterests = window.CCSim.calculateRemainingInterests(schedule);
    const initialTotalDebt = initialPrincipal + (remainingInterests[0] || 0);
    const maxY = Math.max(initialPrincipal * 1.05, initialTotalDebt * 1.05);

    const getY = (val) => yZero - (val / maxY) * plotHeight;

    // Y ticks
    const yTicks = [0, maxY * 0.5, maxY];
    let gridLinesHtml = '';
    yTicks.forEach(tickVal => {
      const y = getY(tickVal);
      gridLinesHtml += `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
        <text x="${padLeft - 8}" y="${y + 4}" font-size="11" fill="#64748b" text-anchor="end" font-family="system-ui">${formatMoney(tickVal, cur)}</text>
      `;
    });

    const axesHtml = `
      <line x1="${padLeft}" y1="${yZero}" x2="${width - padRight}" y2="${yZero}" stroke="#cbd5e1" stroke-width="1.5" />
      <line x1="${padLeft}" y1="${padTop - 5}" x2="${padLeft}" y2="${yZero}" stroke="#cbd5e1" stroke-width="1.5" />
    `;

    const slotWidth = plotWidth / totalMonths;
    const barWidth = Math.max(2, Math.min(28, slotWidth * 0.72));

    let barsHtml = '';
    const selectedIdx = monthDetail ? monthDetail.selectedIndex : 0;

    schedule.forEach((row, idx) => {
      const xCenter = padLeft + (idx + 0.5) * slotWidth;
      const xLeft = xCenter - barWidth / 2;
      const remInt = remainingInterests[idx] || 0;

      const principalHeight = Math.max(0, (row.balance / maxY) * plotHeight);
      const interestHeight = Math.max(0, (remInt / maxY) * plotHeight);
      const totalBarHeight = principalHeight + interestHeight;

      const yPrincipal = yZero - principalHeight;
      const yDebt = yZero - totalBarHeight;
      const isSelected = (idx === selectedIdx);

      barsHtml += `
        <g class="bar-group ${isSelected ? 'selected' : ''}" data-idx="${idx}" data-month="${row.month}">
          <rect class="bar-principal" x="${xLeft}" y="${yPrincipal}" width="${barWidth}" height="${principalHeight}" rx="1" />
          <rect class="bar-debt" x="${xLeft}" y="${yDebt}" width="${barWidth}" height="${interestHeight}" rx="1" />
          <rect class="bar-hitbox" x="${xCenter - slotWidth / 2}" y="${padTop}" width="${slotWidth}" height="${plotHeight + 10}" fill="transparent" />
        </g>
      `;
    });

    svg.innerHTML = gridLinesHtml + axesHtml + barsHtml;

    // Update Month Detail Box
    if (monthDetail) {
      if (el.detailBadge) el.detailBadge.textContent = monthDetail.badgeText;
      if (el.detailTimeElapsed) el.detailTimeElapsed.textContent = monthDetail.timeElapsedText;
      if (el.detailProgressPill) el.detailProgressPill.textContent = monthDetail.progressPillText;
      if (el.detailTotalDebt) el.detailTotalDebt.textContent = formatMoney(monthDetail.totalDebt, cur);
      if (el.detailPrincipalLeft) el.detailPrincipalLeft.textContent = `${formatMoney(monthDetail.row.balance, cur)} Principal`;
      if (el.detailInterestLeft) el.detailInterestLeft.textContent = `+${formatMoney(monthDetail.remInterest, cur)} Interest`;
      if (el.detailPayment) el.detailPayment.textContent = formatMoney(monthDetail.row.payment, cur);
      if (el.detailPaymentSplit) el.detailPaymentSplit.textContent = monthDetail.paymentSplitText;
      if (el.detailEndingBalance) el.detailEndingBalance.textContent = formatMoney(monthDetail.row.balance, cur);
      if (el.detailRemainingMonths) el.detailRemainingMonths.textContent = monthDetail.remainingHint;
    }
  }

  // =========================================================================
  // DOM Event Listeners
  // =========================================================================
  function initEvents() {
    // Currency Toggle
    el.curBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dispatch({ type: 'SET_CURRENCY', currency: btn.dataset.cur });
      });
    });

    // Preset chips
    el.presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = context.currency === 'THB' ? Number(chip.dataset.presetThb) : Number(chip.dataset.presetUsd);
        context = window.CCSim.setPurchaseAmount(context, val);
        context = Object.freeze({
          ...context,
          itemName: chip.dataset.itemName || 'Item'
        });
        render();
      });
    });

    // Custom purchase input
    el.purchaseAmount.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        dispatch({ type: 'SET_PURCHASE_AMOUNT', amount: val });
      }
    });

    // Habit Card Radios
    el.strategyRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          dispatch({ type: 'SET_STRATEGY', strategy: e.target.value });
        }
      });
    });

    // Minimum Payment Slider
    if (el.minPayPercent) {
      el.minPayPercent.addEventListener('input', (e) => {
        dispatch({ type: 'SET_MIN_PAY_PERCENT', percent: parseFloat(e.target.value) });
      });
    }

    // Fixed Payment Slider & Pill Presets
    if (el.fixedPayAmount) {
      el.fixedPayAmount.addEventListener('input', (e) => {
        dispatch({ type: 'SET_FIXED_PAY_AMOUNT', amount: parseFloat(e.target.value) });
      });
    }

    if (el.quickFixedBtns) {
      el.quickFixedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = context.currency === 'THB' ? Number(btn.dataset.fixedThb) : Number(btn.dataset.fixedUsd);
          dispatch({ type: 'SET_FIXED_PAY_AMOUNT', amount: val });
        });
      });
    }

    // Promo Scenario 3-Way Buttons
    if (el.promoScenBtns) {
      el.promoScenBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          dispatch({ type: 'SET_PROMO_SCENARIO', promoScenario: btn.dataset.promoScen });
        });
      });
    }

    // APR Rate buttons (Deep Dive)
    if (el.rateBtns) {
      el.rateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const rate = parseFloat(btn.dataset.rate);
          dispatch({ type: 'SET_APR', apr: rate });
        });
      });
    }

    // Chart touch / dragging (iPad & mobile touch support)
    let isDragging = false;
    function scrubChart(e) {
      const sim = window.CCSim.calculateSimulation({
        principal: context.purchaseAmount,
        apr: context.apr,
        strategy: context.strategy,
        minPayPercent: context.minPayPercent,
        fixedPay: context.fixedPayAmount,
        promoScenario: context.promoScenario,
        currency: context.currency
      });

      if (!sim.schedule || sim.schedule.length === 0) return;
      const rect = el.chartContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const padLeft = 60;
      const padRight = 35;
      const plotWidth = rect.width - padLeft - padRight;
      if (plotWidth <= 0) return;

      const relX = Math.max(0, Math.min(plotWidth, x - padLeft));
      const totalMonths = sim.schedule.length;
      const idx = Math.min(totalMonths - 1, Math.max(0, Math.floor((relX / plotWidth) * totalMonths)));
      dispatch({ type: 'SELECT_MONTH_INDEX', index: idx });
    }

    if (el.chartContainer) {
      el.chartContainer.addEventListener('pointerdown', (e) => {
        isDragging = true;
        try { el.chartContainer.setPointerCapture(e.pointerId); } catch (err) {}
        scrubChart(e);
      });

      el.chartContainer.addEventListener('pointermove', (e) => {
        if (isDragging) scrubChart(e);
      });

      const stopDrag = (e) => {
        if (isDragging) {
          isDragging = false;
          try { el.chartContainer.releasePointerCapture(e.pointerId); } catch (err) {}
        }
      };

      el.chartContainer.addEventListener('pointerup', stopDrag);
      el.chartContainer.addEventListener('pointercancel', stopDrag);
      el.chartContainer.addEventListener('lostpointercapture', stopDrag);

      if (el.balanceChart) {
        el.balanceChart.addEventListener('click', (e) => {
          const group = e.target.closest('.bar-group');
          if (group) {
            const idx = parseInt(group.dataset.idx, 10);
            if (!isNaN(idx)) dispatch({ type: 'SELECT_MONTH_INDEX', index: idx });
          }
        });
      }
    }
  }

  // Public debugging & automation API
  window.getSimContext = () => context;
  window.dispatchSimAction = dispatch;

  // Initialize
  initEvents();
  render();
})();
