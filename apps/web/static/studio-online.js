/* Runtime Garden Social Studio · online editor (P2 slice 3b).
   Explicit server ownership: projects and revisions come from the JSON API
   with the session-bound CSRF token; the browser stores nothing (no
   localStorage). Rendering reuses the shared Design Kit v2 canvas core
   (packages/studio-core, served as /assets/studio-core.js). */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var CORE = window.RGStudioCore;
  var NEW_SLIDE = CORE.NEW_SLIDE;
  var frame = CORE.frame;
  var getFormat = CORE.getFormat;

  var state = {
    csrf: '',
    user: null,
    projects: [],
    projectId: null,
    head: 0,
    project: null,
    dirty: false,
    saving: false,
    tab: 'edit',
    revisions: [],
  };
  var logoImages = {};

  function setSaveState(text) {
    $('saveState').textContent = text;
  }

  function reportError(error) {
    console.error(error);
    setSaveState('Something went wrong');
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

  function formatWhen(iso) {
    var date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  function currentSlide() {
    var index = Math.min(state.project.selected, state.project.slides.length - 1);
    return state.project.slides[Math.max(0, index)];
  }

  /* ---------- rendering ---------- */

  function renderCanvas() {
    if (!state.project) return;
    var canvas = $('studioCanvas');
    var index = Math.min(state.project.selected, state.project.slides.length - 1);
    frame(canvas.getContext('2d'), currentSlide(), index, state.project.slides.length, {
      guides: false,
    });
    var format = getFormat(currentSlide());
    $('formatPill').textContent = format.w + ' × ' + format.h;
    $('layoutName').textContent = currentSlide().name || currentSlide().id;
  }

  function renderProjectChrome() {
    var hasProject = Boolean(state.project);
    $('projectNameLabel').textContent = hasProject ? state.project.name : 'No project open';
    $('headBadge').textContent = hasProject ? 'revision ' + state.head : 'no revision';
  }

  function renderProjects() {
    var list = $('projectList');
    list.textContent = '';
    $('projectEmpty').hidden = state.projects.length > 0;
    state.projects.forEach(function (project) {
      var item = document.createElement('li');
      item.className = 'project-item' + (project.id === state.projectId ? ' selected' : '');
      item.tabIndex = 0;
      var name = document.createElement('b');
      name.textContent = project.name;
      var meta = document.createElement('small');
      meta.textContent = 'Revision ' + project.latestRevision + ' · ' + formatWhen(project.updatedAt);
      item.append(name, meta);
      item.addEventListener('click', function () {
        openProject(project.id).catch(reportError);
      });
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') openProject(project.id).catch(reportError);
      });
      list.appendChild(item);
    });
  }

  function renderInspector() {
    var panel = $('editPanel');
    panel.textContent = '';
    if (!state.project) {
      var empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'Open or create a project to edit its frame.';
      panel.appendChild(empty);
      return;
    }
    var slide = currentSlide();
    var field = document.createElement('div');
    field.className = 'field';
    var label = document.createElement('label');
    label.htmlFor = 'titleField';
    label.textContent = 'Main headline';
    var input = document.createElement('textarea');
    input.id = 'titleField';
    input.dataset.key = 'title';
    input.rows = 3;
    input.maxLength = 260;
    input.value = slide.title;
    input.addEventListener('input', function () {
      slide.title = input.value;
      if (!state.dirty) {
        state.dirty = true;
        setSaveState('Unsaved changes');
      }
      renderCanvas();
    });
    field.append(label, input);
    panel.appendChild(field);
    var hint = document.createElement('p');
    hint.className = 'tiny-note';
    hint.textContent =
      'The headline renders through the same cover layout as the offline editor. ' +
      'Saving appends a server revision.';
    panel.appendChild(hint);
  }

  function renderRevisions() {
    var list = $('revisionList');
    list.textContent = '';
    $('revisionEmpty').hidden = state.revisions.length > 0;
    state.revisions.forEach(function (revision) {
      var item = document.createElement('li');
      item.className = 'revision-item';
      var head = document.createElement('div');
      head.className = 'revision-head';
      var label = document.createElement('b');
      label.textContent = 'Revision ' + revision.revision;
      head.appendChild(label);
      if (revision.revision === state.head) {
        var tag = document.createElement('span');
        tag.className = 'badge current';
        tag.textContent = 'current';
        head.appendChild(tag);
      }
      var meta = document.createElement('small');
      meta.textContent = formatWhen(revision.createdAt) + ' · ' + revision.editorVersion;
      item.append(head, meta);
      if (revision.revision !== state.head) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'outline';
        button.textContent = 'Restore as new revision';
        button.addEventListener('click', function () {
          restoreRevision(revision.revision).catch(reportError);
        });
        item.appendChild(button);
      }
      list.appendChild(item);
    });
  }

  function showConflict(currentRevision) {
    $('conflictText').textContent =
      'The server is on revision ' + currentRevision + ' — your edit was based on revision ' +
      state.head + '. Reload the latest head to continue.';
    $('conflictBanner').hidden = false;
    setSaveState('Conflict — reload required');
  }

  /* ---------- data flows ---------- */

  function loadProjects() {
    return api('/projects?limit=50')
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (body) {
        if (!body) return;
        state.projects = body.projects;
        renderProjects();
      });
  }

  function openProject(id) {
    return api('/projects/' + encodeURIComponent(id))
      .then(function (response) {
        if (!response.ok) throw new Error('Project could not be opened');
        return response.json();
      })
      .then(function (body) {
        state.projectId = body.project.id;
        state.head = body.project.latestRevision;
        state.project = body.revision.project;
        state.dirty = false;
        $('conflictBanner').hidden = true;
        renderProjects();
        renderProjectChrome();
        renderCanvas();
        renderInspector();
        setSaveState('Saved revision ' + state.head);
        return state.tab === 'history' ? loadHistory() : null;
      });
  }

  function createProject() {
    var button = $('newProjectBtn');
    button.disabled = true;
    return postJson('/projects', {
      project: {
        name: 'Untitled project',
        seriesPack: 'none',
        selected: 0,
        slides: [NEW_SLIDE('cover')],
      },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Project could not be created');
        return response.json();
      })
      .then(function (body) {
        return loadProjects().then(function () {
          return openProject(body.project.id);
        });
      })
      .finally(function () {
        button.disabled = false;
      });
  }

  function projectPayload() {
    return {
      name: state.project.name,
      seriesPack: state.project.seriesPack,
      selected: state.project.selected,
      slides: state.project.slides,
    };
  }

  function save() {
    if (!state.projectId || !state.project || state.saving) return Promise.resolve();
    state.saving = true;
    return postJson('/projects/' + encodeURIComponent(state.projectId) + '/revisions', {
      expectedRevision: state.head,
      project: projectPayload(),
    })
      .then(function (response) {
        if (response.status === 409) {
          return response.json().then(function (body) {
            showConflict(body.currentRevision);
          });
        }
        if (!response.ok) throw new Error('Save failed');
        return response.json().then(function (body) {
          state.head = body.revision.revision;
          state.dirty = false;
          setSaveState('Saved revision ' + state.head);
          renderProjectChrome();
          return loadProjects();
        });
      })
      .finally(function () {
        state.saving = false;
      });
  }

  function loadHistory() {
    if (!state.projectId) return Promise.resolve();
    return api('/projects/' + encodeURIComponent(state.projectId) + '/revisions?limit=100')
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (body) {
        if (!body) return;
        state.revisions = body.revisions;
        renderRevisions();
      });
  }

  function restoreRevision(revision) {
    return api('/projects/' + encodeURIComponent(state.projectId) + '/revisions/' + revision)
      .then(function (response) {
        if (!response.ok) throw new Error('Revision could not be loaded');
        return response.json();
      })
      .then(function (body) {
        return postJson('/projects/' + encodeURIComponent(state.projectId) + '/revisions', {
          expectedRevision: state.head,
          project: body.revision.project,
        }).then(function (response) {
          if (response.status === 409) {
            return response.json().then(function (conflict) {
              showConflict(conflict.currentRevision);
            });
          }
          if (!response.ok) throw new Error('Restore failed');
          return response.json().then(function (saved) {
            state.head = saved.revision.revision;
            state.project = body.revision.project;
            state.dirty = false;
            $('conflictBanner').hidden = true;
            setSaveState('Saved revision ' + state.head);
            renderProjectChrome();
            renderCanvas();
            renderInspector();
            return loadProjects().then(loadHistory);
          });
        });
      });
  }

  function exportProject() {
    if (!state.projectId) return;
    var link = document.createElement('a');
    link.href = '/api/v1/projects/' + encodeURIComponent(state.projectId) + '/export';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function logout() {
    postJson('/auth/logout')
      .then(function () {
        window.location.assign('/login');
      })
      .catch(reportError);
  }

  /* ---------- chrome ---------- */

  function switchTab(tab) {
    state.tab = tab;
    $('editTab').classList.toggle('selected', tab === 'edit');
    $('historyTab').classList.toggle('selected', tab === 'history');
    $('editPanel').hidden = tab !== 'edit';
    $('historyPanel').hidden = tab !== 'history';
    if (tab === 'history') loadHistory().catch(reportError);
  }

  function initLogos() {
    var sources = window.RG_OFFICIAL_LOGOS || {};
    return Promise.all(
      Object.keys(sources).map(function (key) {
        return new Promise(function (resolve) {
          var image = new Image();
          image.onload = function () {
            logoImages[key] = image;
            resolve();
          };
          image.onerror = resolve;
          image.src = sources[key];
        });
      }),
    );
  }

  function bindUi() {
    $('newProjectBtn').addEventListener('click', function () {
      createProject().catch(reportError);
    });
    $('saveBtn').addEventListener('click', function () {
      save().catch(reportError);
    });
    $('exportBtn').addEventListener('click', exportProject);
    $('logoutBtn').addEventListener('click', logout);
    $('editTab').addEventListener('click', function () {
      switchTab('edit');
    });
    $('historyTab').addEventListener('click', function () {
      switchTab('history');
    });
    $('reloadHeadBtn').addEventListener('click', function () {
      if (state.projectId) openProject(state.projectId).catch(reportError);
    });
  }

  function boot() {
    bindUi();
    return api('/auth/me')
      .then(function (response) {
        if (!response.ok) throw new Error('Not authenticated');
        return response.json();
      })
      .then(function (body) {
        state.csrf = body.csrfToken;
        state.user = body.user;
        $('userBadge').textContent = body.user.username;
        CORE.configureRenderer({
          getLogo: function (key) {
            return logoImages[key] || null;
          },
          getImage: function () {
            return null;
          },
        });
        return initLogos();
      })
      .then(loadProjects)
      .then(function () {
        renderProjectChrome();
        if (!state.project) setSaveState('No project open');
      });
  }

  boot().catch(reportError);
})();
