document.addEventListener('DOMContentLoaded', () => {
  const SITE = window.ICL_SITE || {};
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    const setMenuState = (isOpen) => {
      nav.classList.toggle('open', isOpen);
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      document.body.classList.toggle('nav-open', isOpen);
    };
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMenuState(!nav.classList.contains('open'));
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenuState(false)));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenuState(false); });
  }

  /* ---------- Agenda tabs (deep links such as agenda.html#day3 open that day) ---------- */
  document.querySelectorAll('[data-tabs]').forEach(tabWrap => {
    const activate = (id) => {
      const btn = tabWrap.querySelector(`.tab[data-tab="${id}"]`);
      if (!btn) return false;
      tabWrap.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      tabWrap.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === id));
      return true;
    };
    tabWrap.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.tab)));
    const fromHash = () => { if (location.hash && activate(location.hash.slice(1))) tabWrap.scrollIntoView({ block: 'start' }); };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item button').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    item.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(item.classList.contains('open')));
  }));

  /* ---------- Campaign source capture (UTM + click IDs) ----------
     Stored for the browser session and written into hidden fields on every form,
     so each Netlify submission shows which campaign produced the lead. */
  const TRACK_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'li_fat_id'];
  const store = {
    get(key) { try { return sessionStorage.getItem('icl_' + key) || ''; } catch (e) { return ''; } },
    set(key, value) { try { sessionStorage.setItem('icl_' + key, value); } catch (e) { /* storage unavailable */ } }
  };
  const params = new URLSearchParams(location.search);
  TRACK_KEYS.forEach(key => { if (params.get(key)) store.set(key, params.get(key)); });
  if (!store.get('landing_page')) store.set('landing_page', location.pathname + location.search);
  if (!store.get('referrer') && document.referrer && !document.referrer.includes(location.hostname)) store.set('referrer', document.referrer);

  const sourceLabel = () => {
    const src = store.get('utm_source');
    if (src) return [src, store.get('utm_medium'), store.get('utm_campaign')].filter(Boolean).join(' / ');
    if (store.get('gclid')) return 'google / cpc';
    if (store.get('li_fat_id')) return 'linkedin / paid';
    const ref = store.get('referrer');
    if (ref) { try { return new URL(ref).hostname + ' / referral'; } catch (e) { return 'referral'; } }
    return 'direct';
  };

  document.querySelectorAll('form[data-netlify]').forEach(form => {
    const fields = { lead_source: sourceLabel(), landing_page: store.get('landing_page') };
    TRACK_KEYS.forEach(key => { fields[key] = store.get(key); });
    Object.entries(fields).forEach(([name, value]) => {
      let input = form.querySelector(`input[name="${name}"]`);
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.appendChild(input);
      }
      input.value = value;
    });
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    });
  });

  /* ---------- Registration: date chips, delegate repeater, booking summary ---------- */
  const registrationForm = document.querySelector('form[data-form-type="registration"]');
  const sessionSelect = registrationForm ? registrationForm.querySelector('select[name="session"]') : null;
  const delegateContainer = document.querySelector('[data-delegate-container]');
  const addDelegateBtn = document.getElementById('addDelegateBtn');
  const bookingSummary = document.getElementById('bookingSummary');
  const setHidden = (name, value) => {
    const input = registrationForm && registrationForm.querySelector(`input[name="${name}"]`);
    if (input) input.value = value;
  };
  // Formatted by hand (R67 497.30) because browsers differ on the en-ZA decimal separator.
  const money = (amount) => {
    const [whole, cents] = Number(amount).toFixed(2).split('.');
    return 'R' + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + cents;
  };

  document.querySelectorAll('.date-chip').forEach(chip => chip.addEventListener('click', () => {
    if (!sessionSelect) return;
    const match = [...sessionSelect.options].find(o => chip.dataset.location ? o.dataset.location === chip.dataset.location : o.dataset.delivery === chip.dataset.delivery);
    if (match) sessionSelect.value = match.value;
    sessionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    sessionSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  // Pre-select a session from ?format=online / ?format=classroom (used by ad links and session cards).
  if (sessionSelect) {
    const format = (params.get('format') || '').toLowerCase();
    const wanted = format === 'online' ? 'Live Online' : format === 'classroom' ? 'Face-to-Face' : format === 'inhouse' ? 'In-House / Customised' : '';
    if (wanted) {
      const city = (params.get('city') || '').toLowerCase();
      const match = [...sessionSelect.options].find(o => o.dataset.delivery === wanted && (!city || (o.dataset.location || '').toLowerCase().replace(/\s+/g, '-') === city));
      if (match) sessionSelect.value = match.value;
    }
  }

  const delegateTemplate = (index) => `
      <div class="delegate-entry-head">
        <div><h4>Delegate ${index}</h4><span>Additional attendee</span></div>
        <button type="button" class="remove-delegate" aria-label="Remove delegate ${index}">Remove</button>
      </div>
      <div class="two-col">
        <label>Full name *<input required data-field="full_name" placeholder="Full name"></label>
        <label>Job title *<input required data-field="job_title" placeholder="${SITE.jobTitlePlaceholder || 'Job title'}"></label>
      </div>
      <div class="two-col">
        <label>Email address *<input required type="email" data-field="email" placeholder="name@company.co.za"></label>
        <label>Mobile / phone<input data-field="phone" placeholder="+27"></label>
      </div>
      <label>Dietary requirements<input data-field="dietary" placeholder="For classroom delegates"></label>
      <label>Accessibility requirements / notes<textarea data-field="accessibility_notes" placeholder="Accessibility needs or notes for this delegate"></textarea></label>`;

  const updateBookingSummary = () => {
    if (!delegateContainer || !bookingSummary) return;
    const count = delegateContainer.querySelectorAll('.delegate-entry').length;
    const option = sessionSelect ? sessionSelect.selectedOptions[0] : null;
    const chosen = option && option.value;
    const price = chosen ? Number(option.dataset.price || 0) : 0;
    const delivery = chosen ? option.dataset.delivery || '' : '';
    const location = chosen ? option.dataset.location || '' : '';

    let rate = 0;
    let pkg = 'No group discount';
    if (count >= 10) pkg = '10+ delegates – custom group quotation';
    else if (count >= 6) { rate = 0.15; pkg = '6–9 delegates – 15% Team Package'; }
    else if (count >= 3) { rate = 0.10; pkg = '3–5 delegates – 10% Team Package'; }

    let feeText = 'Select a session';
    let discountAmount = 0;
    if (chosen && price > 0) {
      const base = price * count;
      discountAmount = count >= 10 ? 0 : base * rate;
      const total = base - discountAmount;
      if (count >= 10) feeText = `${money(base)} excl. VAT before custom group quotation`;
      else if (rate) feeText = `${money(total)} excl. VAT (${count} × ${money(price)} less ${Math.round(rate * 100)}%)`;
      else feeText = `${money(total)} excl. VAT (${count} delegate${count === 1 ? '' : 's'} × ${money(price)})`;
    } else if (chosen) {
      feeText = delivery === 'In-House / Customised' ? 'Quoted separately for in-house delivery' : 'Fee confirmed on quotation';
      pkg = delivery === 'In-House / Customised' ? 'Custom in-house quotation' : pkg;
    }

    setHidden('delegate_count', String(count));
    setHidden('delivery', delivery);
    setHidden('venue_or_platform', location);
    setHidden('unit_fee_excl_vat', price > 0 ? money(price) : 'Quoted separately');
    setHidden('group_discount_package', pkg);
    setHidden('group_discount_rate', rate ? `${Math.round(rate * 100)}%` : (count >= 10 ? 'Custom' : '0%'));
    setHidden('group_discount_amount_excl_vat', money(discountAmount));
    setHidden('estimated_training_fee_excl_vat', feeText);

    const rows = [
      ['Session', chosen ? option.value : 'Select a session'],
      ['Format', delivery ? `${delivery}${location ? ' · ' + location : ''}` : '—'],
      ['Delegates', String(count)],
      ['Group discount', pkg],
      ['Estimated fee', feeText]
    ];
    bookingSummary.innerHTML = '<strong>Booking summary</strong>' + rows.map(([k, v]) => `<span><em>${k}</em>${v}</span>`).join('');
  };

  const renumberDelegates = () => {
    if (!delegateContainer) return;
    [...delegateContainer.querySelectorAll('.delegate-entry')].forEach((entry, position) => {
      const index = position + 1;
      entry.dataset.delegateIndex = index;
      const title = entry.querySelector('h4');
      const subtitle = entry.querySelector('.delegate-entry-head span');
      const removeBtn = entry.querySelector('.remove-delegate');
      if (title) title.textContent = `Delegate ${index}`;
      if (subtitle) subtitle.textContent = index === 1 ? 'Primary attendee' : 'Additional attendee';
      if (removeBtn) { removeBtn.hidden = index === 1; removeBtn.setAttribute('aria-label', `Remove delegate ${index}`); }
      entry.querySelectorAll('[data-field]').forEach(field => { field.name = `delegate_${index}_${field.dataset.field}`; });
    });
    if (addDelegateBtn) addDelegateBtn.hidden = delegateContainer.querySelectorAll('.delegate-entry').length >= 10;
    updateBookingSummary();
  };

  if (delegateContainer && addDelegateBtn) {
    addDelegateBtn.addEventListener('click', () => {
      const entry = document.createElement('div');
      entry.className = 'delegate-entry';
      entry.innerHTML = delegateTemplate(delegateContainer.querySelectorAll('.delegate-entry').length + 1);
      delegateContainer.appendChild(entry);
      renumberDelegates();
      entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const first = entry.querySelector('input');
      if (first) first.focus({ preventScroll: true });
    });
    delegateContainer.addEventListener('click', event => {
      const btn = event.target.closest('.remove-delegate');
      if (!btn) return;
      btn.closest('.delegate-entry').remove();
      renumberDelegates();
    });
    if (sessionSelect) sessionSelect.addEventListener('change', updateBookingSummary);
    renumberDelegates();
  }

  /* ---------- Help chat with preset answers ---------- */
  const bot = document.querySelector('[data-chatbot]');
  if (bot) {
    const panel = bot.querySelector('.chatbot-panel');
    const toggleBtn = bot.querySelector('.chatbot-toggle');
    const answer = bot.querySelector('.chatbot-answer');
    const setOpen = (open) => { panel.hidden = !open; toggleBtn.setAttribute('aria-expanded', String(open)); };
    toggleBtn.addEventListener('click', () => setOpen(panel.hidden));
    bot.querySelector('.chatbot-close').addEventListener('click', () => setOpen(false));
    const responses = SITE.chat || {};
    bot.querySelectorAll('[data-reply]').forEach(btn => btn.addEventListener('click', () => {
      answer.innerHTML = `<div class="bot-message bot-message-answer">${responses[btn.dataset.reply] || responses.contact || ''}</div>`;
    }));
  }
});
