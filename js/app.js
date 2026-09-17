(function () {
  "use strict";

  const STORAGE_KEY = "brenTalkingPoints_v1";

  /** @typedef {{parent:string, child:string|null}} Topic */
  /** @typedef {{id:string, text:string, topics:Topic[], audiences:string[], events:string[]}} TalkingPoint */

  /** @type {{points: TalkingPoint[], script: {order:string[], opening:string, closing:string}, templates: {name:string, order:string[], opening:string, closing:string}[]}} */
  let state = loadState();

  const filters = {
    topics: new Set(), // "Parent" or "Parent::Child"
    audiences: new Set(),
    events: new Set(),
    search: ""
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.points)) return normalizeState(parsed);
      }
    } catch (e) {
      console.warn("Could not read saved data, starting fresh.", e);
    }
    return normalizeState({
      points: SEED_TALKING_POINTS.map((p) => ({ ...p })),
      script: { order: [], opening: "", closing: "" },
      templates: []
    });
  }

  function normalizeState(s) {
    return {
      points: s.points || [],
      script: {
        order: (s.script && s.script.order) || [],
        opening: (s.script && s.script.opening) || "",
        closing: (s.script && s.script.closing) || ""
      },
      templates: s.templates || []
    };
  }

  function saveState() {
    // Storage is unavailable in private-browsing and blocked-site-data modes; the tool still
    // works for the session, so don't let a failed write break the interaction.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save to browser storage; changes will be lost on reload.", e);
    }
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function pointById(id) {
    return state.points.find((p) => p.id === id);
  }

  // ---------- Filtering ----------

  function pointMatchesFilters(p) {
    if (filters.search) {
      if (!p.text.toLowerCase().includes(filters.search.toLowerCase())) return false;
    }
    if (filters.topics.size > 0) {
      const matches = p.topics.some((t) => {
        if (filters.topics.has(t.parent)) return true;
        if (t.child && filters.topics.has(t.parent + "::" + t.child)) return true;
        return false;
      });
      if (!matches) return false;
    }
    if (filters.audiences.size > 0) {
      if (p.audiences.length > 0 && !p.audiences.some((a) => filters.audiences.has(a))) return false;
    }
    if (filters.events.size > 0) {
      if (p.events.length > 0 && !p.events.some((ev) => filters.events.has(ev))) return false;
    }
    return true;
  }

  function getFilteredPoints() {
    return state.points.filter(pointMatchesFilters);
  }

  // ---------- Rendering: Sidebar ----------

  function renderSidebar() {
    const topicTree = document.getElementById("topic-tree");
    topicTree.innerHTML = "";
    Object.entries(TOPIC_TAXONOMY).forEach(([parent, children]) => {
      const parentRow = renderCheckboxRow(
        parent,
        filters.topics.has(parent),
        () => toggleFilter(filters.topics, parent),
        "topic-parent"
      );
      topicTree.appendChild(parentRow);

      const childList = document.createElement("div");
      childList.className = "child-list";
      children.forEach((child) => {
        const key = parent + "::" + child;
        const row = renderCheckboxRow(
          child,
          filters.topics.has(key),
          () => toggleFilter(filters.topics, key),
          "topic-child"
        );
        childList.appendChild(row);
      });
      topicTree.appendChild(childList);
    });

    const audienceList = document.getElementById("audience-list");
    audienceList.innerHTML = "";
    AUDIENCE_TAXONOMY.forEach((a) => {
      audienceList.appendChild(
        renderCheckboxRow(a, filters.audiences.has(a), () => toggleFilter(filters.audiences, a))
      );
    });

    const eventList = document.getElementById("event-list");
    eventList.innerHTML = "";
    EVENT_TAXONOMY.forEach((ev) => {
      eventList.appendChild(
        renderCheckboxRow(ev, filters.events.has(ev), () => toggleFilter(filters.events, ev))
      );
    });

    document.getElementById("clear-filters-btn").onclick = () => {
      filters.topics.clear();
      filters.audiences.clear();
      filters.events.clear();
      filters.search = "";
      document.getElementById("search-input").value = "";
      renderAll();
    };
  }

  function renderCheckboxRow(label, checked, onChange, extraClass) {
    const row = document.createElement("label");
    row.className = "checkbox-row" + (extraClass ? " " + extraClass : "");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    if (onChange) input.addEventListener("change", onChange);
    const span = document.createElement("span");
    span.textContent = label;
    row.appendChild(input);
    row.appendChild(span);
    return row;
  }

  function toggleFilter(set, key) {
    if (set.has(key)) set.delete(key);
    else set.add(key);
    renderAll();
  }

  // ---------- Rendering: Talking point list ----------

  function renderList() {
    const list = document.getElementById("point-list");
    list.innerHTML = "";
    const points = getFilteredPoints();

    document.getElementById("result-count").textContent =
      points.length + " of " + state.points.length + " talking points";

    if (points.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No talking points match these filters.";
      list.appendChild(empty);
      return;
    }

    points.forEach((p) => list.appendChild(renderPointCard(p)));
  }

  function renderPointCard(p) {
    const card = document.createElement("div");
    card.className = "point-card";

    const top = document.createElement("div");
    top.className = "point-card-top";

    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "add-to-script";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.script.order.includes(p.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) addToScript(p.id);
      else removeFromScript(p.id);
      renderScriptPanel();
      renderList();
    });
    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(document.createTextNode(" add to script"));
    top.appendChild(checkboxLabel);

    const actions = document.createElement("div");
    actions.className = "point-card-actions";
    const editBtn = makeIconButton("Edit", () => openPointModal(p.id));
    const deleteBtn = makeIconButton("Delete", () => deletePoint(p.id));
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    top.appendChild(actions);

    card.appendChild(top);

    const text = document.createElement("p");
    text.className = "point-text";
    text.textContent = p.text;
    card.appendChild(text);

    const tags = document.createElement("div");
    tags.className = "tag-row";
    p.topics.forEach((t) => {
      tags.appendChild(makeTag(t.child ? t.parent + " → " + t.child : t.parent, "tag-topic"));
    });
    p.audiences.forEach((a) => tags.appendChild(makeTag(a, "tag-audience")));
    p.events.forEach((ev) => tags.appendChild(makeTag(ev, "tag-event")));
    if (p.audiences.length === 0 && p.events.length === 0) {
      tags.appendChild(makeTag("Applies everywhere", "tag-universal"));
    }
    card.appendChild(tags);

    return card;
  }

  function makeTag(label, className) {
    const span = document.createElement("span");
    span.className = "tag " + className;
    span.textContent = label;
    return span;
  }

  function makeIconButton(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function deletePoint(id) {
    if (!confirm("Remove this talking point? This cannot be undone.")) return;
    state.points = state.points.filter((p) => p.id !== id);
    removeFromScript(id);
    saveState();
    renderAll();
  }

  // ---------- Script builder ----------

  function addToScript(id) {
    if (!state.script.order.includes(id)) {
      state.script.order.push(id);
      saveState();
    }
  }

  function removeFromScript(id) {
    state.script.order = state.script.order.filter((x) => x !== id);
    saveState();
  }

  function moveInScript(id, direction) {
    const arr = state.script.order;
    const idx = arr.indexOf(id);
    const newIdx = idx + direction;
    if (idx < 0 || newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    saveState();
    renderScriptPanel();
  }

  function renderScriptPanel() {
    const container = document.getElementById("script-items");
    container.innerHTML = "";
    const validOrder = state.script.order.filter((id) => pointById(id));
    if (validOrder.length !== state.script.order.length) {
      state.script.order = validOrder;
      saveState();
    }

    document.getElementById("script-count").textContent = String(validOrder.length);

    if (validOrder.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Check “add to script” on any talking point to build your script.";
      container.appendChild(empty);
    } else {
      validOrder.forEach((id, i) => {
        const p = pointById(id);
        const row = document.createElement("div");
        row.className = "script-item";

        const textEl = document.createElement("p");
        textEl.textContent = p.text;
        row.appendChild(textEl);

        const controls = document.createElement("div");
        controls.className = "script-item-controls";
        const up = makeIconButton("↑", () => moveInScript(id, -1));
        up.disabled = i === 0;
        const down = makeIconButton("↓", () => moveInScript(id, 1));
        down.disabled = i === validOrder.length - 1;
        const remove = makeIconButton("Remove", () => {
          removeFromScript(id);
          renderScriptPanel();
          renderList();
        });
        controls.appendChild(up);
        controls.appendChild(down);
        controls.appendChild(remove);
        row.appendChild(controls);

        container.appendChild(row);
      });
    }

    document.getElementById("opening-line").value = state.script.opening;
    document.getElementById("closing-line").value = state.script.closing;

    renderTemplateSelect();
  }

  function buildScriptText() {
    const parts = [];
    if (state.script.opening.trim()) parts.push(state.script.opening.trim());
    state.script.order.forEach((id) => {
      const p = pointById(id);
      if (p) parts.push(p.text);
    });
    if (state.script.closing.trim()) parts.push(state.script.closing.trim());
    return parts.join("\n\n");
  }

  async function copyScript() {
    const text = buildScriptText();
    try {
      await navigator.clipboard.writeText(text);
      flashStatus("script-status", "Copied to clipboard.");
    } catch (e) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      flashStatus("script-status", "Copied to clipboard.");
    }
  }

  function flashStatus(elId, message) {
    const el = document.getElementById(elId);
    el.textContent = message;
    el.classList.add("visible");
    setTimeout(() => el.classList.remove("visible"), 2000);
  }

  // ---------- Templates ----------

  function renderTemplateSelect() {
    const select = document.getElementById("template-select");
    const current = select.value;
    select.innerHTML = '<option value="">Load a saved template…</option>';
    state.templates.forEach((t, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = t.name;
      select.appendChild(opt);
    });
    if (state.templates[Number(current)]) select.value = current;
  }

  function saveTemplate() {
    const name = prompt("Name this template (e.g. “Donor Event Script”):");
    if (!name || !name.trim()) return;
    state.templates.push({
      name: name.trim(),
      order: [...state.script.order],
      opening: state.script.opening,
      closing: state.script.closing
    });
    saveState();
    renderTemplateSelect();
    flashStatus("script-status", "Template saved.");
  }

  function loadTemplate(index) {
    const t = state.templates[index];
    if (!t) return;
    state.script.order = t.order.filter((id) => pointById(id));
    state.script.opening = t.opening;
    state.script.closing = t.closing;
    saveState();
    renderAll();
  }

  function deleteTemplate(index) {
    const t = state.templates[index];
    if (!t) return;
    if (!confirm('Delete template "' + t.name + '"?')) return;
    state.templates.splice(index, 1);
    saveState();
    renderTemplateSelect();
  }

  // ---------- Add / Edit point modal ----------

  let editingPointId = null;

  function openPointModal(id) {
    editingPointId = id || null;
    const point = id ? pointById(id) : null;

    document.getElementById("point-modal-title").textContent = point ? "Edit talking point" : "Add talking point";
    document.getElementById("point-text-input").value = point ? point.text : "";

    const selectedTopics = point ? point.topics : [];
    const isTopicSelected = (parent, child) =>
      selectedTopics.some((t) => t.parent === parent && (t.child || "") === (child || ""));

    const topicPicker = document.getElementById("point-topic-picker");
    topicPicker.innerHTML = "";

    const addTopicOption = (container, label, parent, child, extraClass) => {
      const row = renderCheckboxRow(label, isTopicSelected(parent, child), null, "topic-option" + (extraClass ? " " + extraClass : ""));
      row.dataset.parent = parent;
      row.dataset.child = child || "";
      container.appendChild(row);
    };

    Object.entries(TOPIC_TAXONOMY).forEach(([parent, children]) => {
      addTopicOption(topicPicker, parent + " (general)", parent, null, "topic-parent");
      const childList = document.createElement("div");
      childList.className = "child-list";
      children.forEach((child) => addTopicOption(childList, child, parent, child, "topic-child"));
      topicPicker.appendChild(childList);
    });

    // Imported points may carry tags outside the taxonomy; keep them selectable so editing doesn't drop them.
    const extraTopics = selectedTopics.filter(
      (t) => !(t.parent in TOPIC_TAXONOMY) || (t.child && !TOPIC_TAXONOMY[t.parent].includes(t.child))
    );
    extraTopics.forEach((t) => {
      const label = t.child ? t.parent + " → " + t.child : t.parent + " (general)";
      addTopicOption(topicPicker, label, t.parent, t.child || null, "topic-parent");
    });

    renderValuePicker("point-audience-picker", "audience-option", AUDIENCE_TAXONOMY, point ? point.audiences : []);
    renderValuePicker("point-event-picker", "event-option", EVENT_TAXONOMY, point ? point.events : []);

    document.getElementById("point-modal").classList.add("open");
  }

  function renderValuePicker(containerId, optionClass, taxonomy, selected) {
    const values = taxonomy.concat(selected.filter((v) => !taxonomy.includes(v)));
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    values.forEach((value) => {
      const row = renderCheckboxRow(value, selected.includes(value), null, optionClass);
      row.dataset.value = value;
      container.appendChild(row);
    });
  }

  function closePointModal() {
    document.getElementById("point-modal").classList.remove("open");
    editingPointId = null;
  }

  function savePointFromModal() {
    const text = document.getElementById("point-text-input").value.trim();
    if (!text) {
      alert("Talking point text can't be empty.");
      return;
    }

    const topics = [];
    document.querySelectorAll("#point-topic-picker .topic-option").forEach((row) => {
      if (row.querySelector("input").checked) {
        topics.push({ parent: row.dataset.parent, child: row.dataset.child || null });
      }
    });

    const audiences = [];
    document.querySelectorAll("#point-audience-picker .audience-option").forEach((row) => {
      if (row.querySelector("input").checked) audiences.push(row.dataset.value);
    });

    const events = [];
    document.querySelectorAll("#point-event-picker .event-option").forEach((row) => {
      if (row.querySelector("input").checked) events.push(row.dataset.value);
    });

    if (editingPointId) {
      const p = pointById(editingPointId);
      p.text = text;
      p.topics = topics;
      p.audiences = audiences;
      p.events = events;
    } else {
      state.points.push({ id: uid("tp"), text, topics, audiences, events });
    }

    saveState();
    closePointModal();
    renderAll();
  }

  // ---------- Import / Export ----------

  function openImportModal() {
    document.getElementById("import-textarea").value = "";
    document.getElementById("import-status").textContent = "";
    document.getElementById("import-modal").classList.add("open");
  }

  function closeImportModal() {
    document.getElementById("import-modal").classList.remove("open");
  }

  function runImport() {
    const raw = document.getElementById("import-textarea").value.trim();
    const statusEl = document.getElementById("import-status");
    if (!raw) {
      statusEl.textContent = "Paste a JSON array first.";
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      statusEl.textContent = "That's not valid JSON: " + e.message;
      return;
    }
    if (!Array.isArray(parsed)) {
      statusEl.textContent = "Expected a JSON array of talking points.";
      return;
    }

    const existingTexts = new Set(state.points.map((p) => p.text));
    let added = 0;
    let skipped = 0;
    parsed.forEach((item) => {
      if (!item || typeof item.text !== "string" || !item.text.trim()) {
        skipped++;
        return;
      }
      if (existingTexts.has(item.text)) {
        skipped++;
        return;
      }
      state.points.push({
        id: uid("tp"),
        text: item.text,
        topics: Array.isArray(item.topics) ? item.topics : [],
        audiences: Array.isArray(item.audiences) ? item.audiences : [],
        events: Array.isArray(item.events) ? item.events : []
      });
      existingTexts.add(item.text);
      added++;
    });

    saveState();
    statusEl.textContent =
      "Imported " + added + " talking point" + (added === 1 ? "" : "s") +
      (skipped ? " (" + skipped + " skipped as duplicates or invalid)." : ".") +
      " Total is now " + state.points.length + ".";
    renderAll();
  }

  const EXPORT_FILENAME = "bren-talking-points-export.json";

  // In the Claude artifact viewer a page can only hand over a file through the downloads
  // capability, and a plain <a download> is inert; on the web the reverse. Resolve which one
  // this view has, and only offer the button when a save path exists.
  const inArtifactViewer = !!(window.claude && typeof window.claude.use === "function");
  let downloadsApi = null;

  if (inArtifactViewer) {
    window.claude
      .use("downloads")
      .then((ns) => {
        downloadsApi = ns;
        document.getElementById("export-download-btn").hidden = !ns;
      })
      .catch(() => {});
  }

  function exportJSON() {
    return JSON.stringify(state.points.map(({ id, ...rest }) => rest), null, 2);
  }

  function openExportModal() {
    document.getElementById("export-textarea").value = exportJSON();
    document.getElementById("export-count").textContent = String(state.points.length);
    document.getElementById("export-download-btn").hidden = inArtifactViewer && !downloadsApi;
    document.getElementById("export-modal").classList.add("open");
  }

  function closeExportModal() {
    document.getElementById("export-modal").classList.remove("open");
  }

  async function copyExport() {
    const textarea = document.getElementById("export-textarea");
    try {
      await navigator.clipboard.writeText(textarea.value);
    } catch (e) {
      textarea.select();
      document.execCommand("copy");
    }
    flashStatus("export-status", "Copied to clipboard.");
  }

  async function downloadExport() {
    const json = exportJSON();

    if (downloadsApi) {
      try {
        await downloadsApi.save({ filename: EXPORT_FILENAME, data: json });
        flashStatus("export-status", "Saved.");
      } catch (e) {
        if (e && e.code === "declined") return;
        flashStatus("export-status", "Couldn't save the file. Use Copy JSON instead.");
      }
      return;
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = EXPORT_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- Wiring ----------

  function renderAll() {
    renderSidebar();
    renderList();
    renderScriptPanel();
  }

  function wireStaticControls() {
    document.getElementById("search-input").addEventListener("input", (e) => {
      filters.search = e.target.value;
      renderList();
    });

    document.getElementById("add-point-btn").addEventListener("click", () => openPointModal(null));
    document.getElementById("import-btn").addEventListener("click", openImportModal);
    document.getElementById("export-btn").addEventListener("click", openExportModal);
    document.getElementById("export-modal-close").addEventListener("click", closeExportModal);
    document.getElementById("export-modal-backdrop").addEventListener("click", closeExportModal);
    document.getElementById("export-copy-btn").addEventListener("click", copyExport);
    document.getElementById("export-download-btn").addEventListener("click", downloadExport);

    document.getElementById("point-modal-cancel").addEventListener("click", closePointModal);
    document.getElementById("point-modal-save").addEventListener("click", savePointFromModal);
    document.getElementById("point-modal-backdrop").addEventListener("click", closePointModal);

    document.getElementById("import-modal-cancel").addEventListener("click", closeImportModal);
    document.getElementById("import-modal-run").addEventListener("click", runImport);
    document.getElementById("import-modal-backdrop").addEventListener("click", closeImportModal);

    document.getElementById("opening-line").addEventListener("input", (e) => {
      state.script.opening = e.target.value;
      saveState();
    });
    document.getElementById("closing-line").addEventListener("input", (e) => {
      state.script.closing = e.target.value;
      saveState();
    });

    document.getElementById("copy-script-btn").addEventListener("click", copyScript);
    document.getElementById("save-template-btn").addEventListener("click", saveTemplate);
    document.getElementById("load-template-btn").addEventListener("click", () => {
      const select = document.getElementById("template-select");
      if (select.value !== "") loadTemplate(Number(select.value));
    });
    document.getElementById("delete-template-btn").addEventListener("click", () => {
      const select = document.getElementById("template-select");
      if (select.value !== "") deleteTemplate(Number(select.value));
    });

    document.getElementById("clear-script-btn").addEventListener("click", () => {
      if (!confirm("Clear the current script?")) return;
      state.script.order = [];
      state.script.opening = "";
      state.script.closing = "";
      saveState();
      renderAll();
    });
  }

  wireStaticControls();
  renderAll();
})();
