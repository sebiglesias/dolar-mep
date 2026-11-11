// Calculadora Dólar MEP Hoy - Cotización, Comisiones y Parking
(function() {
  'use strict';

  const API_URL = 'https://sebiglesias.com.ar/ar-data-api/v1/all.json';

  // State
  let state = {
    mode: 'buy', // 'buy' | 'sell' | 'target'
    amount: 500000,
    brokerFeePct: 0.5, // 0.5% default
    bymaFeePct: 0.01,  // 0.01% derechos de mercado
    quotes: {
      mepVenta: 1587.90,
      mepCompra: 1560.20,
      blueVenta: 1555.00,
      tarjetaVenta: 2041.00,
      oficialVenta: 1570.00,
      updatedAt: null
    }
  };

  function formatMoneyARS(val) {
    return '$' + Math.round(val).toLocaleString('es-AR');
  }

  function formatMoneyUSD(val) {
    return 'US$ ' + val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatRate(val) {
    return '$' + val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Check market hours: Mon-Fri 11:00 to 17:00 UTC-3
  function checkMarketStatus() {
    const now = new Date();
    // Convert to Argentina time (UTC-3)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const artDate = new Date(utc - (3 * 3600000));

    const day = artDate.getDay();
    const hours = artDate.getHours();
    const isOpen = (day >= 1 && day <= 5) && (hours >= 11 && hours < 17);

    const statusPill = document.getElementById('market-status');
    if (statusPill) {
      if (isOpen) {
        statusPill.className = 'market-status-pill open';
        statusPill.innerHTML = '<span class="status-dot"></span> Mercado Abierto (11 a 17 hs)';
      } else {
        statusPill.className = 'market-status-pill closed';
        statusPill.innerHTML = '<span class="status-dot"></span> Mercado Cerrado (Último cierre)';
      }
    }
  }

  async function fetchQuotes() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('API network response error');
      const data = await res.json();
      if (data && data.dolar && data.dolar.cotizaciones) {
        const c = data.dolar.cotizaciones;
        if (c.bolsa) {
          state.quotes.mepVenta = c.bolsa.venta || state.quotes.mepVenta;
          state.quotes.mepCompra = c.bolsa.compra || state.quotes.mepCompra;
        }
        if (c.blue) state.quotes.blueVenta = c.blue.venta || state.quotes.blueVenta;
        if (c.tarjeta) state.quotes.tarjetaVenta = c.tarjeta.venta || state.quotes.tarjetaVenta;
        if (c.oficial) state.quotes.oficialVenta = c.oficial.venta || state.quotes.oficialVenta;
        state.quotes.updatedAt = data.dolar.updated_at || new Date().toISOString();
      }
    } catch (e) {
      console.warn('Fallback quotes used:', e);
    }
    updateQuotesTicker();
    recalculate();
  }

  function updateQuotesTicker() {
    const mepEl = document.getElementById('ticker-mep');
    const blueEl = document.getElementById('ticker-blue');
    const tarjetaEl = document.getElementById('ticker-tarjeta');
    const oficialEl = document.getElementById('ticker-oficial');

    if (mepEl) mepEl.textContent = formatRate(state.quotes.mepVenta);
    if (blueEl) blueEl.textContent = formatRate(state.quotes.blueVenta);
    if (tarjetaEl) tarjetaEl.textContent = formatRate(state.quotes.tarjetaVenta);
    if (oficialEl) oficialEl.textContent = formatRate(state.quotes.oficialVenta);
  }

  function recalculate() {
    const { mode, amount, brokerFeePct, bymaFeePct, quotes } = state;
    const totalFeeRate = (brokerFeePct + bymaFeePct) / 100;

    let resHeroAmount = '';
    let resHeroLabel = '';
    let resHeroSub = '';
    let effectiveRate = 0;
    let brokerFeeARS = 0;
    let bymaFeeARS = 0;
    let grossTotalARS = 0;
    let netTotalARS = 0;
    let netUSD = 0;
    let savingsVsTarjetaARS = 0;

    if (mode === 'buy') {
      // User inputs ARS to buy USD
      grossTotalARS = amount;
      brokerFeeARS = grossTotalARS * (brokerFeePct / 100);
      bymaFeeARS = grossTotalARS * (bymaFeePct / 100);
      netTotalARS = grossTotalARS - brokerFeeARS - bymaFeeARS;
      netUSD = netTotalARS / quotes.mepVenta;
      effectiveRate = grossTotalARS / netUSD;

      resHeroLabel = 'Dólares Netos en Mano';
      resHeroAmount = formatMoneyUSD(netUSD);
      resHeroSub = `Acreditación estimada tras parking (1 día hábil)`;

      // Savings vs paying with credit card (tarjeta)
      const tarjetaCostForSameUSD = netUSD * quotes.tarjetaVenta;
      savingsVsTarjetaARS = tarjetaCostForSameUSD - grossTotalARS;

    } else if (mode === 'sell') {
      // User inputs USD to sell for ARS
      const inputUSD = amount;
      const grossARS = inputUSD * quotes.mepCompra;
      brokerFeeARS = grossARS * (brokerFeePct / 100);
      bymaFeeARS = grossARS * (bymaFeePct / 100);
      netTotalARS = grossARS - brokerFeeARS - bymaFeeARS;
      effectiveRate = netTotalARS / inputUSD;

      resHeroLabel = 'Pesos Netos a Acreditar';
      resHeroAmount = formatMoneyARS(netTotalARS);
      resHeroSub = `En tu caja de ahorro bancaria en pesos`;

    } else if (mode === 'target') {
      // User wants exact X USD
      const desiredUSD = amount;
      const baseARS = desiredUSD * quotes.mepVenta;
      grossTotalARS = baseARS / (1 - totalFeeRate);
      brokerFeeARS = grossTotalARS * (brokerFeePct / 100);
      bymaFeeARS = grossTotalARS * (bymaFeePct / 100);
      netUSD = desiredUSD;
      effectiveRate = grossTotalARS / netUSD;

      resHeroLabel = 'Pesos a Transferir al Broker';
      resHeroAmount = formatMoneyARS(grossTotalARS);
      resHeroSub = `Para recibir exactamente ${formatMoneyUSD(desiredUSD)}`;

      const tarjetaCost = desiredUSD * quotes.tarjetaVenta;
      savingsVsTarjetaARS = tarjetaCost - grossTotalARS;
    }

    // Update Hero
    document.getElementById('res-hero-label').textContent = resHeroLabel;
    document.getElementById('res-hero-amount').textContent = resHeroAmount;
    document.getElementById('res-hero-sub').textContent = resHeroSub;

    // Update Hero Meta
    document.getElementById('res-effective-rate').textContent = formatRate(effectiveRate);
    document.getElementById('res-broker-fee-rate').textContent = `${brokerFeePct.toFixed(2)}%`;
    document.getElementById('res-parking-time').textContent = '24 hs hábiles (AL30)';

    // Update Breakdown table
    document.getElementById('row-mep-base').textContent = formatRate(mode === 'sell' ? quotes.mepCompra : quotes.mepVenta);
    document.getElementById('row-broker-fee').textContent = formatMoneyARS(brokerFeeARS);
    document.getElementById('row-byma-fee').textContent = formatMoneyARS(bymaFeeARS);
    document.getElementById('row-effective-rate').textContent = formatRate(effectiveRate);

    // Savings card
    const savingsCard = document.getElementById('savings-comparison-card');
    if (savingsVsTarjetaARS > 0 && mode !== 'sell') {
      savingsCard.style.display = 'block';
      savingsCard.innerHTML = `
        🎉 <strong>¡Ahorro significativo!</strong> Comprando vía MEP pagás <strong>${formatMoneyARS(savingsVsTarjetaARS)} menos</strong> que consumiendo con Dólar Tarjeta ($${quotes.tarjetaVenta.toLocaleString('es-AR')}/USD).
      `;
    } else {
      savingsCard.style.display = 'none';
    }

    // Save
    localStorage.setItem('dolar_mep_state', JSON.stringify({
      mode: state.mode,
      amount: state.amount,
      brokerFeePct: state.brokerFeePct
    }));
  }

  function setMode(newMode) {
    state.mode = newMode;
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === newMode);
    });

    const inputLabel = document.getElementById('input-amount-label');
    const currencySym = document.getElementById('input-currency-symbol');
    const inputEl = document.getElementById('input-amount');

    if (newMode === 'buy') {
      inputLabel.textContent = 'Monto en Pesos a Invertir (ARS)';
      currencySym.textContent = '$';
      if (state.amount < 1000) state.amount = 500000;
    } else if (newMode === 'sell') {
      inputLabel.textContent = 'Monto en Dólares a Vender (USD)';
      currencySym.textContent = 'US$';
      if (state.amount > 100000) state.amount = 500;
    } else if (newMode === 'target') {
      inputLabel.textContent = '¿Cuántos Dólares querés recibir? (USD)';
      currencySym.textContent = 'US$';
      if (state.amount > 100000) state.amount = 1000;
    }

    inputEl.value = state.amount;
    recalculate();
  }

  function init() {
    checkMarketStatus();

    // Restore saved
    const saved = localStorage.getItem('dolar_mep_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.mode) state.mode = parsed.mode;
        if (parsed.amount) state.amount = parsed.amount;
        if (parsed.brokerFeePct !== undefined) state.brokerFeePct = parsed.brokerFeePct;
      } catch (e) {}
    }

    // Mode segmented buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
      });
    });

    // Amount input
    const inputAmount = document.getElementById('input-amount');
    inputAmount.value = state.amount;
    inputAmount.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      state.amount = val;
      recalculate();
    });

    // Broker Fee Slider / input
    const inputFee = document.getElementById('input-broker-fee');
    if (inputFee) {
      inputFee.value = state.brokerFeePct;
      inputFee.addEventListener('input', (e) => {
        state.brokerFeePct = Math.max(0, Math.min(2.5, parseFloat(e.target.value) || 0));
        recalculate();
      });
    }

    // Broker Chips Presets
    document.querySelectorAll('.broker-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.broker-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const fee = parseFloat(chip.dataset.fee);
        state.brokerFeePct = fee;
        if (inputFee) inputFee.value = fee;
        recalculate();
      });
    });

    // FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.parentElement;
        item.classList.toggle('open');
      });
    });

    setMode(state.mode);
    fetchQuotes();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
