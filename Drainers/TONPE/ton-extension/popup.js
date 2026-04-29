const priceMainEl   = document.getElementById("priceMain");
const priceChangeEl = document.getElementById("priceChange");
const chartLineEl   = document.getElementById("chartLine");
const chartAreaEl   = document.getElementById("chartArea");
const periodBtns    = document.querySelectorAll(".period-btn");

let currentPeriod = "24h";

chrome.runtime.sendMessage({ type: "FETCH_NOW" }, (response) => {});
chrome.runtime.sendMessage({ type: "CHECK_CLIPBOARD_NOW" }, (response) => {});

periodBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    periodBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    currentPeriod = btn.dataset.period;
    
    chrome.storage.local.get(["tonPrice", "tonChange1h", "tonChange24h", "tonChange7d"], (data) => {
      if (data.tonPrice != null) {
        render(data);
      }
    });
  });
});

const periodConfig = {
  "1h":  { points: 12, volatility: 0.008 },
  "24h": { points: 24, volatility: 0.025 },
  "7d":  { points: 28, volatility: 0.06 }
};

function updateChart(price, change, period) {
  const pct = change != null ? parseFloat(change) : 0;
  const config = periodConfig[period] || periodConfig["24h"];
  
  const chartClass = pct > 0.01 ? "up" : pct < -0.01 ? "down" : "flat";
  chartLineEl.setAttribute("class", "chart-line " + chartClass);
  chartAreaEl.setAttribute("class", "chart-area " + chartClass);
  
  const { linePath, areaPath } = generateSparkline(pct, parseFloat(price), config, period);
  chartLineEl.setAttribute("d", linePath);
  chartAreaEl.setAttribute("d", areaPath);
}

function generateSparkline(changePct, currentPrice, config, period) {
  const width = 70;
  const height = 28;
  const padding = 2;
  
  const cfg = config || periodConfig["24h"];
  const numPoints = cfg.points;
  const volatility = cfg.volatility;
  
  let basePrice = currentPrice || 3;
  let prices = [];
  
  const startPrice = currentPrice / (1 + changePct / 100);
  
  let seed = numPoints * 1000 + Math.floor(currentPrice * 100) + period.charCodeAt(0);
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    const trendPrice = startPrice + (currentPrice - startPrice) * progress;
    const variation = (pseudoRandom() - 0.5) * volatility * basePrice;
    prices.push(trendPrice + variation);
  }
  
  prices[prices.length - 1] = currentPrice;
  
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = (maxPrice - minPrice) * 1.4 || 1;
  const midPrice = (minPrice + maxPrice) / 2;
  
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const x = padding + (i / (numPoints - 1)) * (width - padding * 2);
    const normalizedPrice = (prices[i] - midPrice) / priceRange + 0.5;
    const y = padding + (1 - normalizedPrice) * (height - padding * 2);
    points.push({ x, y });
  }
  
  const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;
  
  return { linePath, areaPath };
}

function render(data) {
  const { tonPrice, tonChange1h, tonChange24h, tonChange7d } = data;

  if (tonPrice != null) {
    priceMainEl.classList.remove("loading");
    priceMainEl.textContent = "$" + parseFloat(tonPrice).toFixed(2);
    
    let change = tonChange24h;
    
    if (currentPeriod === "1h") {
      change = tonChange1h;
    } else if (currentPeriod === "7d") {
      change = tonChange7d;
    }
    
    const pct = change != null ? parseFloat(change) : 0;
    const abs = Math.abs(pct).toFixed(2);

    priceChangeEl.classList.remove("loading");
    
    if (pct > 0.01) {
      priceChangeEl.className = "price-change up";
      priceChangeEl.textContent = "+" + abs + "%";
    } else if (pct < -0.01) {
      priceChangeEl.className = "price-change down";
      priceChangeEl.textContent = "-" + abs + "%";
    } else {
      priceChangeEl.className = "price-change flat";
      priceChangeEl.textContent = "0.00%";
    }

    updateChart(tonPrice, change, currentPeriod);
  }
}

chrome.storage.local.get(
  ["tonPrice", "tonChange1h", "tonChange24h", "tonChange7d"],
  (data) => {
    render(data);
    
    if (data.tonPrice == null) {
      chrome.runtime.sendMessage({ type: "FETCH_NOW" });
    }
  }
);

chrome.storage.onChanged.addListener(() => {
  chrome.storage.local.get(
    ["tonPrice", "tonChange1h", "tonChange24h", "tonChange7d"],
    render
  );
});
