(() => {
  'use strict';

  /* =========================================================
     Helpers
     ========================================================= */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const numberFmt = new Intl.NumberFormat('ru-RU');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const money = (value) => numberFmt.format(Math.round(value / 1000) * 1000) + ' ₽';

  function plural(n, one, few, many) {
    const abs = Math.abs(n);
    if (!Number.isInteger(abs)) return few;
    const n10 = abs % 10;
    const n100 = abs % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  /* =========================================================
     Calculator config
     ========================================================= */

  const LEVELS = {
    cosmetic: {
      label: 'Косметический',
      apt: 9500,
      bathStd: 210000,
      bath: { compact: 165000, standard: 210000, spacious: 265000 },
      weeksApt: 0.13,
      weeksBath: 3
    },
    capital: {
      label: 'Капитальный',
      apt: 16500,
      bathStd: 290000,
      bath: { compact: 230000, standard: 290000, spacious: 370000 },
      weeksApt: 0.24,
      weeksBath: 4
    },
    design: {
      label: 'Дизайнерский',
      apt: 27000,
      bathStd: 390000,
      bath: { compact: 310000, standard: 390000, spacious: 495000 },
      weeksApt: 0.33,
      weeksBath: 5
    }
  };

  const BATH_SIZES = {
    compact: { label: 'до 4 м²', area: 3.5 },
    standard: { label: '4–6 м²', area: 5 },
    spacious: { label: 'более 6 м²', area: 7.5 }
  };

  const MATERIAL_RATE = { apartment: 0.5, bathroom: 0.45 };
  const MATERIAL_MIN = 0.4;
  const MATERIAL_MAX = 0.6;

  /* =========================================================
     Elements
     ========================================================= */

  const calcSection = $('#calc');
  const calcForm = $('#calcForm');
  const areaInput = $('#area');
  const areaOut = $('#areaOut');
  const bathsValue = $('#bathsValue');
  const summaryList = $('#summaryList');
  const totalValueEl = $('#totalValue');
  const totalRangeEl = $('#totalRange');
  const materialsEl = $('#materialsValue');
  const grandEl = $('#grandValue');
  const weeksEl = $('#weeksValue');
  const perM2El = $('#perM2Value');
  const summaryModeEl = $('#summaryMode');
  const calcStatus = $('#calcStatus');

  const contactSection = $('#contact');
  const contactForm = $('#contactForm');
  const formWrap = $('#formWrap');
  const formSuccess = $('#formSuccess');
  const successText = $('#successText');
  const messageInput = $('#message');
  const requestSelect = $('#request');
  const nameInput = $('#name');
  const phoneInput = $('#phone');
  const consentInput = $('#consent');

  /* =========================================================
     State + calculations
     ========================================================= */

  function selectedValue(name) {
    const checked = $(`input[name="${name}"]:checked`, calcForm);
    return checked ? checked.value : null;
  }

  function getBaths() {
    return Math.max(1, Math.min(3, parseInt(bathsValue.textContent, 10) || 1));
  }

  function compute() {
    const mode = selectedValue('mode') || 'apartment';
    const levelKey = selectedValue('level') || 'capital';
    const level = LEVELS[levelKey];
    const baths = getBaths();
    const area = parseInt(areaInput.value, 10) || 20;
    const bathSize = selectedValue('bathSize') || 'standard';

    const lines = [];
    const optionLabels = [];
    let works = 0;
    let percent = 0;
    let designLabel = '';

    if (mode === 'apartment') {
      const base = area * level.apt;
      lines.push({ label: `Работы по квартире · ${area} м²`, value: base });
      works += base;

      const bathTotal = level.bathStd * baths;
      lines.push({
        label: `Санузел под ключ · ${baths} ${plural(baths, 'санузел', 'санузла', 'санузлов')}`,
        value: bathTotal
      });
      works += bathTotal;
    } else {
      const size = BATH_SIZES[bathSize];
      const base = level.bath[bathSize] * baths;
      lines.push({
        label: `Санузел под ключ · ${baths} × ${size.label}`,
        value: base
      });
      works += base;
    }

    const options = $$('.opt', calcForm).filter((input) =>
      input.checked && input.dataset.mode === mode
    );

    options.forEach((input) => {
      optionLabels.push(input.dataset.label);
      if (input.dataset.type === 'percent') {
        percent += parseFloat(input.dataset.price) || 0;
        designLabel = input.dataset.label;
        return;
      }
      const price = parseFloat(input.dataset.price) || 0;
      const multiplier = input.dataset.unit === 'm2' ? area : baths;
      const value = price * multiplier;
      if (value > 0) {
        lines.push({ label: input.dataset.label, value });
        works += value;
      }
    });

    if (percent > 0) {
      const value = works * percent;
      lines.push({
        label: `${designLabel} · ${Math.round(percent * 100)}%`,
        value
      });
      works += value;
    }

    const materials = works * MATERIAL_RATE[mode];
    const grand = works + materials;
    const worksMin = works * 0.94;
    const worksMax = works * 1.06;

    const bathArea = BATH_SIZES[bathSize].area * baths;
    const perM2 = mode === 'apartment' ? works / area : works / bathArea;

    let weeks;
    if (mode === 'apartment') {
      weeks = Math.max(3, area * level.weeksApt + 1.2 + (baths - 1) * 0.6);
    } else {
      weeks = level.weeksBath + (baths - 1) * 1.5;
    }
    weeks = Math.round(weeks * 2) / 2;

    return {
      mode,
      levelKey,
      levelLabel: level.label,
      baths,
      area,
      bathSize,
      sizeLabel: BATH_SIZES[bathSize].label,
      lines,
      optionLabels,
      works,
      worksMin,
      worksMax,
      materials,
      grand,
      weeks,
      perM2,
      modeLabel: mode === 'apartment' ? 'Квартира' : 'Санузел'
    };
  }

  /* =========================================================
     Rendering
     ========================================================= */

  function animateMoney(element, target) {
    const from = typeof element._money === 'number' ? element._money : 0;
    element._money = target;

    if (reduceMotion || from === target) {
      element.textContent = money(target);
      return;
    }

    if (element._raf) cancelAnimationFrame(element._raf);
    const duration = 360;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = money(from + (target - from) * eased);
      if (progress < 1) {
        element._raf = requestAnimationFrame(tick);
      } else {
        element.textContent = money(target);
      }
    };

    element._raf = requestAnimationFrame(tick);
  }

  function renderSummaryLines(lines) {
    const fragment = document.createDocumentFragment();
    lines.forEach((line) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      const value = document.createElement('b');
      label.textContent = line.label;
      value.textContent = money(line.value);
      li.append(label, value);
      fragment.append(li);
    });
    summaryList.replaceChildren(fragment);
  }

  function render() {
    const state = compute();

    // Slider fill + output
    const min = parseInt(areaInput.min, 10);
    const max = parseInt(areaInput.max, 10);
    const value = parseInt(areaInput.value, 10);
    const fill = ((value - min) / (max - min)) * 100;
    areaInput.style.setProperty('--fill', `${fill}%`);
    areaOut.textContent = `${value} м²`;

    // Counter state
    $$('.counter__btn').forEach((button) => {
      const step = parseInt(button.dataset.step, 10);
      button.disabled = (step < 0 && state.baths <= 1) || (step > 0 && state.baths >= 3);
    });

    // Summary
    summaryModeEl.textContent = `${state.modeLabel} · ${state.levelLabel.toLowerCase()}`;
    renderSummaryLines(state.lines);
    animateMoney(totalValueEl, state.works);
    totalRangeEl.textContent =
      `Диапазон работ: ${money(state.worksMin)} – ${money(state.worksMax)}`;
    materialsEl.textContent = `≈ ${money(state.materials)}`;
    grandEl.textContent = `≈ ${money(state.grand)}`;

    const weeksText = Number.isInteger(state.weeks)
      ? String(state.weeks)
      : state.weeks.toFixed(1).replace('.', ',');
    weeksEl.textContent =
      `≈ ${weeksText} ${plural(state.weeks, 'неделя', 'недели', 'недель')}`;
    perM2El.textContent = `≈ ${money(state.perM2)}/м²`;

    if (calcStatus) {
      calcStatus.textContent =
        `${state.modeLabel}, уровень ${state.levelLabel.toLowerCase()}, ` +
        `санузлов: ${state.baths}. Стоимость работ ${money(state.works)}, ` +
        `с материалами около ${money(state.grand)}. ` +
        `Срок ${weeksText} ${plural(state.weeks, 'неделя', 'недели', 'недель')}.`;
    }

    calcSection.dataset.mode = state.mode;
    return state;
  }

  let renderFrame = null;
  function scheduleRender() {
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      render();
    });
  }

  /* =========================================================
     Calculator interactions
     ========================================================= */

  $$('input[name="mode"]', calcForm).forEach((radio) => {
    radio.addEventListener('change', () => {
      calcSection.dataset.mode = radio.value;
      scheduleRender();
    });
  });

  $$('.counter__btn').forEach((button) => {
    button.addEventListener('click', () => {
      const step = parseInt(button.dataset.step, 10);
      const next = Math.max(1, Math.min(3, getBaths() + step));
      bathsValue.textContent = String(next);
      render();
    });
  });

  calcForm.addEventListener('input', scheduleRender);
  calcForm.addEventListener('change', scheduleRender);

  // Initial paint
  render();

  /* =========================================================
     Calculator → form
     ========================================================= */

  const calcToForm = $('#calcToForm');
  calcToForm.addEventListener('click', () => {
    const state = compute();

    // If a previous request was already "sent", bring the form back.
    if (!formSuccess.hidden) resetFormUI();

    const intro = state.mode === 'apartment'
      ? `Площадь: ${state.area} м², санузлов: ${state.baths}.`
      : `Санузел: ${state.sizeLabel}, количество: ${state.baths}.`;

    const lines = [
      'Здравствуйте! Сделал расчёт на сайте:',
      `${state.modeLabel}, уровень «${state.levelLabel.toLowerCase()}».`,
      intro,
      state.optionLabels.length ? `Дополнительно: ${state.optionLabels.join('; ')}.` : '',
      `Предварительно: ${money(state.works)} за работы, материалы ≈ ${money(state.materials)}.`,
      'Хочу точную смету после бесплатного замера.'
    ].filter(Boolean);

    messageInput.value = lines.join('\n');
    requestSelect.value = state.mode === 'apartment' ? 'apartment' : 'bathroom';

    contactSection.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    });

    window.setTimeout(() => {
      nameInput.focus({ preventScroll: true });
    }, reduceMotion ? 50 : 600);

    formWrap.classList.remove('is-flash');
    void formWrap.offsetWidth;
    formWrap.classList.add('is-flash');
    window.setTimeout(() => formWrap.classList.remove('is-flash'), 1600);
  });

  /* =========================================================
     Lead form
     ========================================================= */

  const nameError = $('#nameError');
  const phoneError = $('#phoneError');
  const consentError = $('#consentError');

  function setFieldError(input, errorEl, message) {
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      errorEl.hidden = true;
    }
  }

  function validateForm() {
    let firstInvalid = null;

    const nameValid = nameInput.value.trim().length >= 2;
    setFieldError(nameInput, nameError, nameValid ? '' : 'Укажите имя — минимум 2 буквы');
    if (!nameValid && !firstInvalid) firstInvalid = nameInput;

    const digits = phoneInput.value.replace(/\D/g, '');
    const phoneValid = digits.length === 11 && digits.startsWith('7');
    setFieldError(phoneInput, phoneError, phoneValid ? '' : 'Введите телефон полностью');
    if (!phoneValid && !firstInvalid) firstInvalid = phoneInput;

    if (!consentInput.checked) {
      consentError.hidden = false;
      if (!firstInvalid) firstInvalid = consentInput;
    } else {
      consentError.hidden = true;
    }

    if (firstInvalid) firstInvalid.focus({ preventScroll: false });
    return !firstInvalid;
  }

  function formatPhone(raw) {
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits[0] === '8') digits = `7${digits.slice(1)}`;
    if (digits[0] !== '7') digits = `7${digits}`;
    digits = digits.slice(0, 11);

    let out = '+7';
    if (digits.length > 1) out += ` (${digits.slice(1, 4)}`;
    if (digits.length >= 5) out += `) ${digits.slice(4, 7)}`;
    if (digits.length >= 8) out += `-${digits.slice(7, 9)}`;
    if (digits.length >= 10) out += `-${digits.slice(9, 11)}`;
    return out;
  }

  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatPhone(phoneInput.value);
  });
  phoneInput.addEventListener('focus', () => {
    if (!phoneInput.value) phoneInput.value = '+7 ';
  });
  phoneInput.addEventListener('blur', () => {
    if (phoneInput.value.trim() === '+7') phoneInput.value = '';
  });

  [nameInput, phoneInput].forEach((input) => {
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        const errorEl = input === nameInput ? nameError : phoneError;
        setFieldError(input, errorEl, '');
      }
    });
  });
  consentInput.addEventListener('change', () => {
    consentError.hidden = consentInput.checked;
  });

  function resetFormUI() {
    formSuccess.hidden = true;
    contactForm.hidden = false;
    contactForm.reset();
    setFieldError(nameInput, nameError, '');
    setFieldError(phoneInput, phoneError, '');
    consentError.hidden = true;
    phoneInput.value = '';
    nameInput.focus({ preventScroll: true });
  }

  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const name = nameInput.value.trim();
    successText.textContent =
      `Спасибо, ${name}! Перезвоним в течение 15 минут в рабочее время, уточним детали и договоримся о замере.`;
    contactForm.hidden = true;
    formSuccess.hidden = false;
    formSuccess.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center'
    });
  });

  $('#resetForm').addEventListener('click', resetFormUI);

  /* =========================================================
     Header / mobile menu
     ========================================================= */

  const header = $('#header');
  const burger = $('#burger');
  const nav = $('#nav');

  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 14);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function closeMenu() {
    header.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
    document.body.classList.remove('no-scroll');
  }

  burger.addEventListener('click', () => {
    const open = header.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.classList.toggle('no-scroll', open);
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) closeMenu();
  });

  /* =========================================================
     FAQ — only one open at a time
     ========================================================= */

  $$('.faq__item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      $$('.faq__item').forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  /* =========================================================
     Reveal on scroll
     ========================================================= */

  const revealItems = $$('.reveal');

  $$('.services__grid, .works__grid, .reviews__grid').forEach((grid) => {
    $$('.reveal', grid).forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
    });
  });

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  /* =========================================================
     Misc
     ========================================================= */

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
