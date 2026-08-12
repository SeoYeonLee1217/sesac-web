(function () {
  "use strict";

  const NORMAL_COLOR = "#2563eb";
  const FRAUD_COLOR = "#dc2626";

  const $ = (sel) => document.querySelector(sel);

  function fmtWon(n) {
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed: " + url);
    return res.json();
  }

  async function init() {
    let data;
    try {
      data = await fetchJSON("data/fraud_summary.json");
    } catch (err) {
      document.querySelector("main").innerHTML =
        '<div class="card" style="text-align:center; padding:48px;">데이터를 불러오지 못했습니다. 새로고침해 주세요.</div>';
      return;
    }

    renderSubtitle(data.meta);
    renderKpi(data.meta);
    renderVolumeChart(data.meta);
    renderAmountChart(data.amount_dist);
    renderHourChart(data.hourly_dist);
    renderRiskCallouts(data.hourly_dist);
    renderRiskChart(data.hourly_dist);
    renderDayChart(data.daily_dist);
    renderScatterChart(data.scatter);
    renderTopFraud(data.top_fraud);
    initScrollReveal();
  }

  function initScrollReveal() {
    const targets = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((el) => io.observe(el));
  }

  function animateCount(el, target, opts) {
    const { duration = 900, decimals = 0, prefix = "", suffix = "" } = opts || {};
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const value = target * eased;
      el.textContent = prefix + value.toLocaleString("ko-KR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderSubtitle(meta) {
    $("#subtitle").textContent =
      `총 ${meta.total.toLocaleString("ko-KR")}건 거래 · 사기 ${meta.fraud_count.toLocaleString("ko-KR")}건 (${meta.fraud_rate}%) · 2013년 유럽 카드사 데이터`;
  }

  function renderKpi(meta) {
    $("#kpiGrid").innerHTML = `
      <div class="card">
        <p class="kpi-label">전체 거래 건수</p>
        <p class="kpi-value" id="kpiTotal">0건</p>
        <p class="kpi-sub">정상 ${meta.normal_count.toLocaleString("ko-KR")}건</p>
      </div>
      <div class="card">
        <p class="kpi-label">사기 거래 건수</p>
        <p class="kpi-value danger" id="kpiFraud">0건</p>
        <p class="kpi-sub">전체의 ${meta.fraud_rate}% (1,000건 중 약 ${(meta.fraud_rate * 10).toFixed(1)}건)</p>
      </div>
      <div class="card">
        <p class="kpi-label">전체 거래 금액</p>
        <p class="kpi-value" id="kpiAmount">$0</p>
        <p class="kpi-sub">건당 평균 ${fmtWon(meta.avg_amount)}</p>
      </div>
      <div class="card">
        <p class="kpi-label">사기 거래 평균 금액</p>
        <p class="kpi-value danger" id="kpiFraudAmount">$0</p>
        <p class="kpi-sub">정상 거래 평균 ${fmtWon(meta.avg_normal_amount)}</p>
      </div>
    `;
    animateCount($("#kpiTotal"), meta.total, { suffix: "건" });
    animateCount($("#kpiFraud"), meta.fraud_count, { suffix: "건" });
    animateCount($("#kpiAmount"), meta.total_amount, { prefix: "$" });
    animateCount($("#kpiFraudAmount"), meta.avg_fraud_amount, { prefix: "$" });
  }

  function renderRiskCallouts(hourly) {
    const peak = hourly.peak_hour;
    const safe = hourly.safest_hour;
    $("#peakHourValue").textContent = `${peak}시`;
    $("#peakHourSub").textContent = `거래 100건 중 약 ${hourly.fraud_rate_by_hour[peak].toFixed(2)}건이 사기`;
    $("#safeHourValue").textContent = `${safe}시`;
    $("#safeHourSub").textContent = `거래 100건 중 약 ${hourly.fraud_rate_by_hour[safe].toFixed(3)}건이 사기`;
  }

  function renderRiskChart(hourly) {
    const peak = hourly.peak_hour;
    new Chart($("#riskChart"), {
      type: "line",
      data: {
        labels: hourly.hours.map((h) => h + "시"),
        datasets: [
          {
            data: hourly.fraud_rate_by_hour,
            borderColor: FRAUD_COLOR,
            backgroundColor: "rgba(220, 38, 38, 0.08)",
            fill: true,
            borderWidth: 2,
            tension: 0.35,
            pointRadius: hourly.hours.map((h) => (h === peak ? 5 : 2)),
            pointBackgroundColor: hourly.hours.map((h) => (h === peak ? FRAUD_COLOR : "#fca5a5")),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1200, easing: "easeOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `사기일 확률 ${ctx.parsed.y}%` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
          y: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => v + "%" } },
        },
      },
    });
  }

  function renderDayChart(daily) {
    new Chart($("#dayChart"), {
      type: "bar",
      data: {
        labels: daily.labels,
        datasets: [
          { label: "정상", data: daily.normal_count, backgroundColor: NORMAL_COLOR, borderRadius: 6, maxBarThickness: 60 },
          { label: "사기", data: daily.fraud_count, backgroundColor: FRAUD_COLOR, borderRadius: 6, maxBarThickness: 60, yAxisID: "y2" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: "easeOutQuart" },
        plugins: {
          legend: { position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 8, color: "#334155", font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const rate = daily.fraud_rate[ctx.dataIndex];
                return ctx.dataset.label === "사기"
                  ? `사기 ${ctx.parsed.y}건 (그날 거래의 ${rate}%)`
                  : `정상 ${ctx.parsed.y.toLocaleString("ko-KR")}건`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#334155", font: { size: 12 } } },
          y: { position: "left", grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 } }, title: { display: true, text: "정상 거래 건수", color: "#94a3b8", font: { size: 10 } } },
          y2: { position: "right", grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 11 } }, title: { display: true, text: "사기 거래 건수", color: "#94a3b8", font: { size: 10 } } },
        },
      },
    });
  }

  function renderVolumeChart(meta) {
    new Chart($("#volumeChart"), {
      type: "bar",
      data: {
        labels: ["정상 거래", "사기 거래"],
        datasets: [
          {
            data: [meta.normal_count, meta.fraud_count],
            backgroundColor: [NORMAL_COLOR, FRAUD_COLOR],
            borderRadius: 6,
            maxBarThickness: 80,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ctx.parsed.x.toLocaleString("ko-KR") + "건" } },
        },
        scales: {
          x: {
            type: "logarithmic",
            grid: { color: "#f1f5f9" },
            ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => Number(v).toLocaleString("ko-KR") },
          },
          y: { grid: { display: false }, ticks: { color: "#334155", font: { size: 13 } } },
        },
      },
    });
  }

  function renderAmountChart(dist) {
    new Chart($("#amountChart"), {
      type: "bar",
      data: {
        labels: dist.labels,
        datasets: [
          { label: "정상", data: dist.normal_pct, backgroundColor: NORMAL_COLOR, borderRadius: 4, maxBarThickness: 22 },
          { label: "사기", data: dist.fraud_pct, backgroundColor: FRAUD_COLOR, borderRadius: 4, maxBarThickness: 22 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label} · ${ctx.parsed.y}%` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } }, title: { display: true, text: "거래 금액($)", color: "#94a3b8", font: { size: 11 } } },
          y: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => v + "%" } },
        },
      },
    });
  }

  function renderHourChart(dist) {
    new Chart($("#hourChart"), {
      type: "line",
      data: {
        labels: dist.hours.map((h) => h + "시"),
        datasets: [
          { label: "정상", data: dist.normal_pct, borderColor: NORMAL_COLOR, backgroundColor: NORMAL_COLOR, borderWidth: 2, pointRadius: 2, tension: 0.3 },
          { label: "사기", data: dist.fraud_pct, borderColor: FRAUD_COLOR, backgroundColor: FRAUD_COLOR, borderWidth: 2, pointRadius: 2, tension: 0.3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label} · ${ctx.parsed.y}%` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
          y: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => v + "%" } },
        },
      },
    });
  }

  function renderScatterChart(scatter) {
    new Chart($("#scatterChart"), {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "정상 거래 (표본 1,500건)",
            data: scatter.normal_sample.map((r) => ({ x: r.v14, y: r.v17 })),
            backgroundColor: "rgba(37, 99, 235, 0.35)",
            pointRadius: 2.5,
          },
          {
            label: "사기 거래 (전체 492건)",
            data: scatter.fraud_all.map((r) => ({ x: r.v14, y: r.v17 })),
            backgroundColor: "rgba(220, 38, 38, 0.75)",
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 8, color: "#334155", font: { size: 12 } } },
          tooltip: { callbacks: { label: (ctx) => `V14 ${ctx.parsed.x} · V17 ${ctx.parsed.y}` } },
        },
        scales: {
          x: { title: { display: true, text: "V14 (익명화된 값)", color: "#94a3b8", font: { size: 11 } }, grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 10 } } },
          y: { title: { display: true, text: "V17 (익명화된 값)", color: "#94a3b8", font: { size: 11 } }, grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 10 } } },
        },
      },
    });
  }

  function renderTopFraud(rows) {
    $("#topFraudBody").innerHTML = rows
      .map(
        (r, i) => `<tr>
          <td>${i + 1}</td>
          <td>${r.time_hr}시간째</td>
          <td class="num">${fmtWon(r.amount)}</td>
        </tr>`
      )
      .join("");
  }

  init();
})();
