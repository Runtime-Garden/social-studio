/* Runtime Garden Social Studio · online sign-in (P2 slice 3b).
   Posts to the JSON auth API and hands off to the gated editor page.
   Slice 4: honors a same-origin ?next= target (set by gated pages like
   /content/) so sign-in returns where the bounce came from. */
'use strict';
(function () {
  var form = document.getElementById('loginForm');
  var error = document.getElementById('loginError');
  var button = document.getElementById('loginBtn');

  function safeNextTarget() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get('next') || '/studio/';
    if (next.charAt(0) !== '/' || next.indexOf('//') !== -1 || next.indexOf('\\') !== -1) {
      return '/studio/';
    }
    return next;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    error.hidden = true;
    button.disabled = true;
    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    })
      .then(function (response) {
        if (response.ok) {
          window.location.assign(safeNextTarget());
          return;
        }
        if (response.status === 401) {
          error.textContent = "The username and password didn't match. Check them and try again.";
        } else if (response.status === 429) {
          error.textContent = 'Too many attempts. Wait a few minutes, then try again.';
        } else {
          error.textContent = 'Sign-in failed. Try again.';
        }
        error.hidden = false;
      })
      .catch(function () {
        error.textContent = 'The server could not be reached.';
        error.hidden = false;
      })
      .finally(function () {
        button.disabled = false;
      });
  });
})();
