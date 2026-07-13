(() => {
  'use strict';

  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#site-menu');

  function closeMenu(restoreFocus = false) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (restoreFocus) menuButton.focus();
  }

  if (menuButton && menu) {
    menuButton.addEventListener('click', () => {
      const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(willOpen));
      menuButton.setAttribute('aria-label', willOpen ? 'Close navigation' : 'Open navigation');
      menu.classList.toggle('is-open', willOpen);
      document.body.classList.toggle('menu-open', willOpen);
      if (willOpen) requestAnimationFrame(() => menu.querySelector('a')?.focus());
    });
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu(false)));
    document.addEventListener('keydown', (event) => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      if (event.key === 'Escape' && isOpen) closeMenu(true);
      if (event.key === 'Tab' && isOpen) {
        const focusable = [menuButton, ...menu.querySelectorAll('a')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    document.body.classList.add('reveal-ready');
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    revealItems.forEach((item) => observer.observe(item));
  }

  document.querySelectorAll('.faq-question').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) return;
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
    });
  });

  const year = document.querySelector('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const form = document.querySelector('#diagnostic-form');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('.form-step'));
  const backButton = form.querySelector('#form-back');
  const nextButton = form.querySelector('#form-next');
  const submitButton = form.querySelector('#form-submit');
  const errorBox = form.querySelector('#form-error');
  const statusBox = form.querySelector('#form-status');
  const stepNumber = form.querySelector('#step-number');
  const progressBar = form.querySelector('#progress-bar');
  let currentStep = 0;

  function fieldsForStep(index) {
    return Array.from(steps[index].querySelectorAll('input, select, textarea'));
  }

  function showStep(index, moveFocus = true) {
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, stepIndex) => { step.hidden = stepIndex !== currentStep; });
    backButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === steps.length - 1;
    submitButton.hidden = currentStep !== steps.length - 1;
    stepNumber.textContent = String(currentStep + 1);
    progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    errorBox.textContent = '';
    if (moveFocus) {
      const heading = steps[currentStep].querySelector('h3');
      if (heading) { heading.tabIndex = -1; heading.focus(); }
    }
  }

  function validateStep(index) {
    const fields = fieldsForStep(index);
    let firstInvalid = null;

    fields.forEach((field) => {
      field.removeAttribute('aria-invalid');
      if (field.getAttribute('aria-describedby') === 'form-error') field.removeAttribute('aria-describedby');
    });

    fields.forEach((field) => {
      if (field.type === 'radio') {
        if (!field.required) return;
        const group = fields.filter((candidate) => candidate.type === 'radio' && candidate.name === field.name);
        if (!group.some((candidate) => candidate.checked) && !firstInvalid) firstInvalid = field;
        return;
      }
      if (!field.checkValidity() && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) {
      firstInvalid.setAttribute('aria-invalid', 'true');
      firstInvalid.setAttribute('aria-describedby', 'form-error');
      errorBox.textContent = 'Please complete the required fields before continuing.';
      firstInvalid.focus();
      return false;
    }
    errorBox.textContent = '';
    return true;
  }

  nextButton.addEventListener('click', () => {
    if (validateStep(currentStep)) showStep(currentStep + 1);
  });
  backButton.addEventListener('click', () => showStep(currentStep - 1));

  function value(name) {
    return new FormData(form).get(name)?.toString().trim() || '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateStep(currentStep)) return;

    if (value('website')) {
      form.reset();
      statusBox.textContent = 'Thank you. Your request has been received.';
      return;
    }

    const message = [
      `Goal: ${value('goal')}`,
      `Meaningful progress: ${value('goalDetail')}`,
      `Experience: ${value('experience')}`,
      `Current frequency: ${value('frequency')}`,
      `Previous barriers: ${value('history') || 'Not provided'}`,
      `Location: ${value('location')}`,
      `Availability: ${value('availability')}`,
      `Six-month commitment: ${value('commitment')}`,
      `Budget: ${value('budget')}`
    ].join('\n\n');

    const payload = {
      name: value('name'),
      email: value('email'),
      phone: value('phone'),
      subject: `Coaching application — ${value('goal')}`,
      message,
      website: '',
      consent: value('consent') === 'on'
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';
    statusBox.textContent = '';
    errorBox.textContent = '';

    try {
      const response = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The request could not be sent.');

      form.reset();
      form.querySelectorAll('.form-step, .form-actions, .form-progress').forEach((element) => { element.hidden = true; });
      statusBox.textContent = 'Your application has been sent. Thomas will review it personally and reply by email.';
      statusBox.tabIndex = -1;
      statusBox.focus();
    } catch (error) {
      const fallback = document.createElement('a');
      const emailBody = `${message}\n\nName: ${payload.name}\nEmail: ${payload.email}\nPhone: ${payload.phone || 'Not provided'}`;
      fallback.href = `mailto:thomas@devresse.fit?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(emailBody)}`;
      fallback.textContent = 'Open your email app with these answers';
      errorBox.replaceChildren(document.createTextNode(`${error.message} `), fallback, document.createTextNode('.'));
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send my application';
    }
  });

  showStep(0, false);
})();
