/* Runtime Garden Social Studio · calendar + ops viewers (P2 remainder).
   Scheduled-variant placeholders from real DB state, per-channel status
   with live approval validity, and read-only audit/jobs tables. No
   submission path exists on this page. Strict CSP: no inline styles. */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };

  var state = { csrf: '', month: '2026-11', tz: 'UTC', selectedVariant: null };

  function reportError(error) {
    console.error(error);
    $('opsState').textContent = 'Something went wrong';
  }

  function api(path, options) {
    var settings = options || {};
    return fetch('/api/v1' + path, {
      method: settings.method || 'GET',
      headers: settings.method && settings.method !== 'GET'
        ? { 'content-type': 'application/json', 'x-csrf-token': state.csrf }
        : {},
      body: settings.body,
    }).then(function (response) {
      if (response.status === 401) {
        window.location.assign('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
        throw new Error('Session expired');
      }
      return response;
    });
  }

  function monthRange(month) {
    var parts = String(month || '').split('-');
    var year = Number(parts[0]);
    var mon = Number(parts[1]);
    if (!Number.isInteger(year) || !Number.isInteger(mon) || mon < 1 || mon > 12) {
      return { from: '2026-11-01', to: '2026-11-30', label: 'November 2026' };
    }
    var last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var label = new Date(Date.UTC(year, mon - 1, 1)).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return { from: year + '-' + pad(mon) + '-01', to: year + '-' + pad(mon) + '-' + last, label: label };
  }

  function renderDayGrid(days) {
    var grid = $('dayGrid');
    grid.textContent = '';
    var total = 0;
    days.forEach(function (day) {
      total += day.entries.length;
      var cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.date = day.date;
      var head = document.createElement('b');
      head.textContent = day.date;
      cell.appendChild(head);
      day.entries.forEach(function (entry) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'day-entry';
        button.dataset.variant = entry.variantId;
        var title = document.createElement('span');
        title.textContent = entry.text || entry.variantId;
        var when = document.createElement('small');
        when.textContent = entry.scheduledAtLocal + ' (' + entry.scheduledAtUtc + ')';
        button.append(title, when);
        button.addEventListener('click', function () {
          selectVariant(entry.variantId);
        });
        cell.appendChild(button);
      });
      grid.appendChild(cell);
    });
    $('calendarEmpty').hidden = total > 0;
  }

  function selectVariant(variantId) {
    state.selectedVariant = variantId;
    return api('/schedule/publications?variantId=' + encodeURIComponent(variantId))
      .then(function (response) {
        return response.ok ? response.json() : { channels: [] };
      })
      .then(function (body) {
        var list = $('channelStatus');
        list.textContent = '';
        var channels = body.channels || [];
        $('channelEmpty').hidden = channels.length > 0;
        channels.forEach(function (channel) {
          var li = document.createElement('li');
          li.className = 'project-item';
          var name = document.createElement('b');
          name.textContent = channel.channelId;
          var meta = document.createElement('small');
          var bits = [channel.submissionState, channel.variantStatus];
          bits.push(!channel.hasApproval ? 'no approval' : channel.approvalValid ? 'approval valid' : 'stale');
          meta.textContent = bits.join(' · ');
          li.append(name, meta);
          list.appendChild(li);
        });
      });
  }

  function renderTable(tbodyId, rows, render) {
    var tbody = $(tbodyId);
    tbody.textContent = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      render(tr, row);
      tbody.appendChild(tr);
    });
  }

  function cell(text) {
    var td = document.createElement('td');
    td.textContent = String(text == null ? '' : text);
    return td;
  }

  function loadMonth() {
    var range = monthRange(state.month);
    $('monthTitle').textContent = range.label;
    $('tzBadge').textContent = state.tz;
    return api(
      '/schedule/calendar?from=' + range.from + '&to=' + range.to + '&tz=' + encodeURIComponent(state.tz),
    )
      .then(function (response) {
        return response.ok ? response.json() : { days: [] };
      })
      .then(function (body) {
        renderDayGrid(body.days || []);
        var first = null;
        (body.days || []).forEach(function (day) {
          if (!first && day.entries.length > 0) first = day.entries[0].variantId;
        });
        if (first) return selectVariant(first);
        state.selectedVariant = null;
        $('channelStatus').textContent = '';
        $('channelEmpty').hidden = false;
      });
  }

  function loadOps() {
    return api('/ops/audit?limit=50')
      .then(function (response) {
        return response.ok ? response.json() : { events: [] };
      })
      .then(function (body) {
        renderTable('auditTable', body.events || [], function (tr, event) {
          tr.append(cell(event.createdAt), cell(event.actor), cell(event.action));
        });
        return api('/ops/jobs?limit=50');
      })
      .then(function (response) {
        return response.ok ? response.json() : { jobs: [] };
      })
      .then(function (body) {
        var jobs = body.jobs || [];
        renderTable('jobsTable', jobs, function (tr, job) {
          tr.append(cell(job.kind), cell(job.state), cell(job.attempts));
        });
        $('jobsEmpty').hidden = jobs.length > 0;
      });
  }

  function readMonthParam() {
    var params = new URLSearchParams(window.location.search);
    var month = params.get('month') || '';
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
    return '2026-11';
  }

  function boot() {
    state.month = readMonthParam();
    $('monthInput').value = state.month;
    $('monthInput').addEventListener('change', function () {
      state.month = $('monthInput').value || state.month;
      loadMonth().catch(reportError);
    });
    $('tzSelect').addEventListener('change', function () {
      state.tz = $('tzSelect').value;
      loadMonth().catch(reportError);
    });
    $('pauseBtn').addEventListener('click', function () {
      api('/ops/pause', { method: 'POST', body: '{}' })
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
        return loadMonth().then(loadOps);
      });
  }

  boot().catch(reportError);
})();
