/* Customer addresses: open and close the forms, confirm deletes, and fill the
   province list for the chosen country. Each country option carries its provinces. */
(() => {
  document.querySelectorAll('[data-address-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) return;
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
      if (!open) panel.querySelector('input, select')?.focus();
    });
  });

  document.querySelectorAll('[data-confirm]').forEach((button) => {
    button.addEventListener('click', (event) => {
      if (!window.confirm(button.dataset.confirm)) event.preventDefault();
    });
  });

  const fillProvinces = (countrySelect, keepValue) => {
    const form = countrySelect.closest('form');
    const wrapper = form.querySelector('[data-address-province-wrapper]');
    const provinceSelect = form.querySelector('[data-address-province]');
    const option = countrySelect.selectedOptions[0];
    let provinces = [];

    try {
      provinces = JSON.parse(option?.dataset.provinces || '[]');
    } catch (error) {
      console.error(error);
    }

    provinceSelect.replaceChildren(
      ...provinces.map(([value, label]) => new Option(label, value))
    );
    wrapper.hidden = provinces.length === 0;
    if (keepValue && provinceSelect.dataset.default) provinceSelect.value = provinceSelect.dataset.default;
  };

  document.querySelectorAll('[data-address-country]').forEach((countrySelect) => {
    if (countrySelect.dataset.default) countrySelect.value = countrySelect.dataset.default;
    fillProvinces(countrySelect, true);
    countrySelect.addEventListener('change', () => fillProvinces(countrySelect, false));
  });
})();
