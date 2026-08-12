(function () {
  "use strict";

  const GU_COLORS = ["#2563eb", "#059669", "#ea580c"];
  const PAGE_SIZE = 50;

  const state = {
    summary: null,
    deals: null, // {fields, gu_list, rows}
    activeGu: new Set([0, 1, 2]),
    query: "",
    sortKey: "p",
    sortDir: "desc",
    visibleCount: PAGE_SIZE,
  };

  let avgPriceChart, volumeChart, trendChart;

  const $ = (sel) => document.querySelector(sel);

  function formatWon(manwon) {
    if (manwon >= 10000) {
      return (manwon / 10000).toFixed(1) + "억";
    }
    return manwon.toLocaleString("ko-KR") + "만원";
  }

  function formatEok(manwon, digits) {
    return (manwon / 10000).toFixed(digits === undefined ? 1 : digits) + "억";
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed: " + url);
    return res.json();
  }

  async function init() {
    try {
      state.summary = await fetchJSON("data/summary.json");
      renderSubtitle();
      renderGuToggles();
      renderKpi();
      renderCompareCharts();
      renderTrendChart();
    } catch (err) {
      showFatalError();
      return;
    }

    try {
      state.deals = await fetchJSON("data/deals.json");
      renderTable();
    } catch (err) {
      $("#dealsBody").innerHTML = "";
      $("#emptyState").hidden = false;
      $("#emptyState").textContent = "데이터를 불러오지 못했습니다. 새로고침해 주세요.";
    }

    bindEvents();
  }

  function showFatalError() {
    document.querySelector("main").innerHTML =
      '<div class="error-state">데이터를 불러오지 못했습니다. 새로고침해 주세요.<br>' +
      '<button class="retry-btn" onclick="location.reload()">다시 시도</button></div>';
  }

  function renderSubtitle() {
    const m = state.summary.meta;
    $("#subtitle").textContent =
      `${m.period.from} ~ ${m.period.to} · 강남/서초/송파 매매 ${m.total_deals.toLocaleString("ko-KR")}건`;
  }

  function renderGuToggles() {
    const wrap = $("#guToggles");
    wrap.innerHTML = "";
    state.summary.meta.gu_list.forEach((name, i) => {
      const btn = document.createElement("button");
      btn.className = "gu-toggle";
      btn.dataset.gu = i;
      btn.dataset.active = state.activeGu.has(i);
      btn.innerHTML = `<span class="dot"></span>${name}`;
      btn.addEventListener("click", () => toggleGu(i));
      wrap.appendChild(btn);
    });
  }

  function toggleGu(i) {
    if (state.activeGu.has(i)) {
      if (state.activeGu.size === 1) return; // must keep at least one
      state.activeGu.delete(i);
    } else {
      state.activeGu.add(i);
    }
    document.querySelectorAll(".gu-toggle").forEach((btn) => {
      const idx = Number(btn.dataset.gu);
      btn.dataset.active = state.activeGu.has(idx);
    });
    state.visibleCount = PAGE_SIZE;
    renderKpi();
    renderCompareCharts();
    renderTrendChart();
    renderTable();
  }

  function activeGuNames() {
    return state.summary.meta.gu_list.filter((_, i) => state.activeGu.has(i));
  }

  function renderKpi() {
    const names = activeGuNames();
    const stats = names.map((n) => state.summary.by_gu[n]);
    const totalCount = stats.reduce((s, d) => s + d.count, 0);
    const avgPrice = stats.reduce((s, d) => s + d.avg_price * d.count, 0) / totalCount;
    const avgPpy = stats.reduce((s, d) => s + d.avg_price_per_pyeong * d.count, 0) / totalCount;
    const maxDeal = stats.reduce((best, d) => (!best || d.max_deal.price > best.price ? d.max_deal : best), null);

    const m = state.summary.meta;
    $("#kpiGrid").innerHTML = `
      <div class="card">
        <p class="kpi-label">평균 매매가</p>
        <p class="kpi-value">${formatEok(avgPrice)}</p>
        <p class="kpi-sub">${totalCount.toLocaleString("ko-KR")}건 기준</p>
      </div>
      <div class="card">
        <p class="kpi-label">총 거래량</p>
        <p class="kpi-value">${totalCount.toLocaleString("ko-KR")}건</p>
        <p class="kpi-sub">${m.period.from} ~ ${m.period.to}</p>
      </div>
      <div class="card">
        <p class="kpi-label">평균 평당가</p>
        <p class="kpi-value">${formatEok(avgPpy)}/평</p>
        <p class="kpi-sub">전용면적 기준</p>
      </div>
      <div class="card">
        <p class="kpi-label">최고가 거래</p>
        <p class="kpi-value">${formatEok(maxDeal.price)}</p>
        <p class="kpi-sub">${maxDeal.complex} · 전용 ${maxDeal.area_m2}㎡</p>
      </div>
    `;
  }

  function renderCompareCharts() {
    const names = activeGuNames();
    const colors = names.map((n) => GU_COLORS[state.summary.meta.gu_list.indexOf(n)]);
    const avgPrices = names.map((n) => +(state.summary.by_gu[n].avg_price / 10000).toFixed(1));
    const counts = names.map((n) => state.summary.by_gu[n].count);

    if (avgPriceChart) avgPriceChart.destroy();
    avgPriceChart = new Chart($("#avgPriceChart"), {
      type: "bar",
      data: {
        labels: names,
        datasets: [{ data: avgPrices, backgroundColor: colors, borderRadius: 6, maxBarThickness: 64 }],
      },
      options: chartBarOptions((v) => v + "억"),
    });

    if (volumeChart) volumeChart.destroy();
    volumeChart = new Chart($("#volumeChart"), {
      type: "bar",
      data: {
        labels: names,
        datasets: [{ data: counts, backgroundColor: colors, borderRadius: 6, maxBarThickness: 64 }],
      },
      options: chartBarOptions((v) => v + "건"),
    });
  }

  function chartBarOptions(labelFmt) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => labelFmt(ctx.parsed.y) },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 12 } } },
        y: {
          grid: { color: "#f1f5f9" },
          ticks: { color: "#94a3b8", font: { size: 11 } },
        },
      },
    };
  }

  function renderTrendChart() {
    const names = activeGuNames();
    const months = state.summary.by_gu[state.summary.meta.gu_list[0]].monthly.map((m) => m.ym);
    const labels = months.map((ym) => ym.slice(2).replace("-", "."));

    const datasets = names.map((n) => {
      const idx = state.summary.meta.gu_list.indexOf(n);
      const monthly = state.summary.by_gu[n].monthly;
      return {
        label: n,
        data: monthly.map((m) => (m.count ? +(m.avg_price / 10000).toFixed(2) : null)),
        counts: monthly.map((m) => m.count),
        borderColor: GU_COLORS[idx],
        backgroundColor: GU_COLORS[idx],
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
        spanGaps: true,
      };
    });

    const allVals = datasets.flatMap((d) => d.data.filter((v) => v !== null));
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const pad = (max - min) * 0.1 || 1;

    if (trendChart) trendChart.destroy();
    trendChart = new Chart($("#trendChart"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 8, color: "#334155", font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const ds = ctx.dataset;
                const c = ds.counts[ctx.dataIndex];
                return ` ${ds.label} · 평균 ${ctx.parsed.y}억 · ${c}건`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 12 } } },
          y: {
            min: +(min - pad).toFixed(1),
            max: +(max + pad).toFixed(1),
            grid: { color: "#f1f5f9" },
            ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => v + "억" },
          },
        },
      },
    });
  }

  function getFilteredSortedRows() {
    const fields = state.deals.fields;
    const idx = Object.fromEntries(fields.map((f, i) => [f, i]));
    let rows = state.deals.rows.filter((r) => state.activeGu.has(r[idx.g]));

    const q = state.query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) => r[idx.c].toLowerCase().includes(q) || r[idx.n].toLowerCase().includes(q)
      );
    }

    const key = state.sortKey;
    const dir = state.sortDir === "asc" ? 1 : -1;
    const ki = idx[key];
    rows = rows.slice().sort((a, b) => {
      const av = a[ki], bv = b[ki];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return { rows, idx };
  }

  function highlight(text, q) {
    if (!q) return escapeHtml(text);
    const lower = text.toLowerCase();
    const pos = lower.indexOf(q);
    if (pos === -1) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, pos)) +
      "<mark>" + escapeHtml(text.slice(pos, pos + q.length)) + "</mark>" +
      escapeHtml(text.slice(pos + q.length))
    );
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderTable() {
    const { rows, idx } = getFilteredSortedRows();
    const q = state.query.trim().toLowerCase();
    const guNames = state.summary.meta.gu_list;

    const countLabel = q
      ? `"${state.query.trim()}" 검색 결과 ${rows.length.toLocaleString("ko-KR")}건`
      : `총 ${rows.length.toLocaleString("ko-KR")}건`;
    $("#tableCount").textContent = countLabel;

    const visible = rows.slice(0, state.visibleCount);
    const body = $("#dealsBody");
    const empty = $("#emptyState");

    if (rows.length === 0) {
      body.innerHTML = "";
      empty.hidden = false;
      empty.textContent = "검색 결과가 없습니다. 다른 단지명을 입력해 보세요.";
    } else {
      empty.hidden = true;
      body.innerHTML = visible
        .map((r) => {
          const gu = r[idx.g];
          return `<tr>
            <td>${r[idx.d]}</td>
            <td><span class="gu-badge" data-gu="${gu}">${guNames[gu]}</span></td>
            <td>${escapeHtml(r[idx.n])}</td>
            <td>${highlight(r[idx.c], q)}</td>
            <td class="num">${r[idx.a]}㎡</td>
            <td class="num">${r[idx.f]}층</td>
            <td class="num price">${formatWon(r[idx.p])}</td>
            <td class="num">${formatEok(r[idx.pp], 2)}</td>
          </tr>`;
        })
        .join("");
    }

    $("#moreBtn").hidden = state.visibleCount >= rows.length;

    document.querySelectorAll("th.sortable").forEach((th) => {
      th.dataset.sortActive = th.dataset.sort === state.sortKey;
      th.querySelector(".arrow").textContent = state.sortKey === th.dataset.sort
        ? (state.sortDir === "asc" ? "▴" : "▾")
        : "▾";
    });
  }

  let searchTimer;
  function bindEvents() {
    $("#searchInput").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      const val = e.target.value;
      $("#searchClear").classList.toggle("visible", val.length > 0);
      searchTimer = setTimeout(() => {
        state.query = val;
        state.visibleCount = PAGE_SIZE;
        renderTable();
      }, 200);
    });

    $("#searchClear").addEventListener("click", () => {
      $("#searchInput").value = "";
      $("#searchClear").classList.remove("visible");
      state.query = "";
      state.visibleCount = PAGE_SIZE;
      renderTable();
    });

    $("#moreBtn").addEventListener("click", () => {
      state.visibleCount += PAGE_SIZE;
      renderTable();
    });

    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = "desc";
        }
        state.visibleCount = PAGE_SIZE;
        renderTable();
      });
    });
  }

  init();
})();
