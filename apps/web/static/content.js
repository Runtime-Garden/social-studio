/* Runtime Garden Social Studio · Content Inbox + approvals (P2 slice 4).
   Read-only inbox, citation review, snapshot approvals and the emergency
   pause control. No publishing path exists on this page; submit stays
   gated server-side by policy. Strict CSP: no inline styles. */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };

  var state = { csrf: '', items: [], contentId: null, variantId: null, channelId: 'chan-1', dirty: false };

  function reportError(error) {
    console.error(error);
    $('opsState').textContent = 'Something went wrong';
  }

  function api(path, options) {
    var settings = options || {};
    var headers = {};
    if (settings.body !== undefined) headers['content-type'] = 'application/json';
    if (settings.method && settings.method !== 'GET') headers['x-csrf-token'] = state.csrf;
    return fetch('/api/v1' + path, {
      method: settings.method || 'GET',
      headers: headers,
      body: settings.body,
    }).then(function (response) {
      if (response.status === 401) {
        window.location.assign('/login');
        throw new Error('Session expired');
      }
      return response;
    });
  }

  function postJson(path, body) {
    return api(path, { method: 'POST', body: JSON.stringify(body) });
  }

  function esc(text) {
    return String(text == null ? '' : text);
  }

  function renderInbox() {
    var list = $('inboxList');
    list.textContent = '';
    $('inboxEmpty').hidden = state.items.length > 0;
    state.items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'project-item' + (item.id === state.contentId ? ' selected' : '');
      li.tabIndex = 0;
      var name = document.createElement('b');
      name.textContent = esc(item.title);
      var meta = document.createElement('small');
      meta.textContent = esc(item.editorialState);
      li.append(name, meta);
      li.addEventListener('click', function () {
        openStory(item.id).catch(reportError);
      });
      li.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') openStory(item.id).catch(reportError);
      });
      list.appendChild(li);
    });
  }

  function renderCitations(sources, claims) {
    var list = $('citationList');
    list.textContent = '';
    var entries = [];
    sources.forEach(function (s) {
      entries.push({ label: s.title || s.canonicalUrl, href: s.canonicalUrl });
    });
    claims.forEach(function (c) {
      entries.push({ label: c.claimText + ' [' + c.verdict + ']', href: c.evidenceUrl });
    });
    $('citationEmpty').hidden = entries.length > 0;
    entries.forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'revision-item';
      var link = document.createElement('a');
      link.href = entry.href;
      link.textContent = entry.label;
      link.rel = 'noopener';
      li.appendChild(link);
      list.appendChild(li);
    });
  }

  function openStory(id) {
    return api('/content/items/' + encodeURIComponent(id))
      .then(function (response) {
        if (!response.ok) throw new Error('Story could not be opened');
        return response.json();
      })
      .then(function (body) {
        state.contentId = body.item.id;
        $('storyTitle').textContent = esc(body.item.title);
        $('storyState').textContent = esc(body.item.editorialState);
        renderInbox();
        renderCitations(body.sources, body.claims);
        return api('/content/items/' + encodeURIComponent(id) + '/variants');
      })
      .then(function (response) {
        return response.ok ? response.json() : { variants: [] };
      })
      .then(function (body) {
        var first = (body.variants || [])[0] || null;
        state.variantId = first ? first.id : null;
        state.dirty = false;
        $('variantText').value = first ? esc(first.text) : '';
        return refreshApproval();
      });
  }

  function refreshApproval() {
    if (!state.variantId) {
      $('approvalState').textContent = 'No variant to approve.';
      return Promise.resolve();
    }
    return api('/content/variants/' + encodeURIComponent(state.variantId) + '/approvals/latest')
      .then(function (response) {
        if (response.status === 404) {
          $('approvalState').textContent = 'No approval recorded.';
          return;
        }
        return response.json().then(function (body) {
          if (!body.valid) {
            $('approvalState').textContent = 'Approval stale — the snapshot no longer matches.';
            return;
          }
          if (body.approval.decision === 'rejected') {
            $('approvalState').textContent = 'Rejected.';
            return;
          }
          if (body.approval.decision === 'returned') {
            $('approvalState').textContent = 'Returned for revision.';
            return;
          }
          $('approvalState').textContent =
            'Approved snapshot ' + String(body.approval.id).slice(0, 8) + ' · valid';
        });
      });
  }

  function saveText() {
    if (!state.variantId) return Promise.resolve();
    return postJson('/content/variants/' + encodeURIComponent(state.variantId) + '/text', {
      text: $('variantText').value,
    }).then(function (response) {
      if (!response.ok) throw new Error('Save failed');
      state.dirty = false;
      return refreshApproval();
    });
  }

  function decide(decision) {
    if (!state.variantId) return Promise.resolve();
    // Approve what the user sees: persist unsaved textarea edits first so
    // the snapshot binds the visible text, not a stale revision.
    var save = state.dirty ? saveText() : Promise.resolve();
    return save.then(function () {
      return postJson('/content/variants/' + encodeURIComponent(state.variantId) + '/approvals', {
        decision: decision,
        channelId: state.channelId,
      });
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Decision failed');
        return refreshApproval().then(function () {
          if (decision === 'rejected') $('approvalState').textContent = 'Rejected.';
        });
      });
  }

  function boot() {
    $('approveBtn').addEventListener('click', function () {
      decide('approved').catch(reportError);
    });
    $('rejectBtn').addEventListener('click', function () {
      decide('rejected').catch(reportError);
    });
    $('saveTextBtn').addEventListener('click', function () {
      saveText().catch(reportError);
    });
    $('variantText').addEventListener('input', function () {
      state.dirty = true;
    });
    $('pauseBtn').addEventListener('click', function () {
      postJson('/ops/pause', {})
        .then(function (response) {
          if (!response.ok) throw new Error('Pause failed');
          $('opsState').textContent = 'Publishing paused';
        })
        .catch(reportError);
    });
    return api('/auth/me')
      .then(function (response) {
        if (!response.ok) throw new Error('Not authenticated');
        return response.json();
      })
      .then(function (body) {
        state.csrf = body.csrfToken;
        return api('/content/items?limit=50');
      })
      .then(function (response) {
        return response.ok ? response.json() : { items: [] };
      })
      .then(function (body) {
        state.items = body.items || [];
        renderInbox();
      });
  }

  boot().catch(reportError);
})();
