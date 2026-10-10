    /* CuddleNest fix (2026-09-22): add to cart without leaving the product page.
       The Amose form used a normal submit, so the browser went to /cart after every add.
       This intercepts the submit, adds the item with the AJAX API and notifies the Horizon
       theme (cart icon count + cart drawer) through the standard CartLinesUpdateEvent. */
    var ajaxForm = root.querySelector('form[action*="/cart/add"]');
    var ajaxBtn = root.querySelector('[data-amose-pi2-atc]');
    if (ajaxForm && ajaxBtn) {
      var ajaxRoot = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      if (ajaxRoot.slice(-1) !== '/') ajaxRoot += '/';
      var isFr = (document.documentElement.lang || '').toLowerCase().indexOf('fr') === 0;
      var addedText = isFr ? '✓ Ajouté au panier' : '✓ Added to cart';
      var errorText = isFr ? "Impossible d'ajouter ce produit. Réessayez." : 'Could not add this item. Please try again.';
      var btnLabel = ajaxBtn.querySelector('.amose-pi2__cta-label');
      var originalLabel = btnLabel ? btnLabel.textContent : '';
      var loadEvents = function() {
        return import('@shopify/events').then(function(m) { return m.CartLinesUpdateEvent; }).catch(function() { return null; });
      };

      ajaxForm.addEventListener('submit', function(event) {
        var submitter = event.submitter;
        if (submitter && submitter.hasAttribute('data-amose-pi2-buy-now')) return;
        event.preventDefault();
        if (ajaxBtn.disabled) return;
        ajaxBtn.disabled = true;
        ajaxBtn.setAttribute('aria-busy', 'true');

        var formData = new FormData(ajaxForm);
        formData.delete('return_to');
        var sectionIds = [];
        document.querySelectorAll('cart-items-component').forEach(function(el) {
          if (el.dataset && el.dataset.sectionId) sectionIds.push(el.dataset.sectionId);
        });
        if (sectionIds.length) formData.append('sections', sectionIds.join(','));
        var qty = parseInt(formData.get('quantity') || '1', 10) || 1;

        loadEvents().then(function(CartEvent) {
          var deferred = CartEvent && CartEvent.createPromise ? CartEvent.createPromise() : null;
          if (deferred) {
            ajaxForm.dispatchEvent(new CartEvent({
              action: 'add',
              context: 'product',
              lines: [{ merchandiseId: String(formData.get('id')), quantity: qty }],
              promise: deferred.promise
            }));
          }

          var addedData = null;
          return fetch(ajaxRoot + 'cart/add.js', {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: formData,
            credentials: 'same-origin'
          })
            .then(function(res) {
              return res.json().then(function(data) {
                if (!res.ok || data.status) throw new Error((data && (data.description || data.message)) || errorText);
                addedData = data;
              });
            })
            .then(function() {
              return fetch(ajaxRoot + 'cart.js', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            })
            .then(function(res) { return res.json(); })
            .then(function(cart) {
              if (deferred) {
                deferred.resolve({
                  cart: CartEvent.createCartFromAjaxResponse ? CartEvent.createCartFromAjaxResponse(cart) : cart,
                  detail: {
                    items: cart.items,
                    sections: addedData && addedData.sections,
                    source: 'amose-product-information-2',
                    itemCount: qty,
                    didError: false
                  }
                });
              }
              if (btnLabel) {
                btnLabel.textContent = addedText;
                setTimeout(function() { btnLabel.textContent = originalLabel; }, 1800);
              }
            })
            .catch(function(err) {
              if (deferred) deferred.reject(err);
              window.alert(err && err.message ? err.message : errorText);
            });
        }).finally(function() {
          ajaxBtn.disabled = false;
          ajaxBtn.removeAttribute('aria-busy');
        });
      });
    }

