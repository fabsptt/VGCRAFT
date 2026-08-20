/* Velha Guarda — Registo de Crafting
   Dados de receitas: window.RECIPES / window.MATERIALS (ver data.js, gerado a partir do ao-bin-dumps).
   Preços: Albion Online Data Project (api pública, servidor Europa).
*/
(function () {
  "use strict";

  var CITIES = ["Fort Sterling", "Lymhurst", "Bridgewatch", "Martlock", "Thetford", "Caerleon", "Brecilien"];
  var CITY_DOT = {
    "Fort Sterling": "#dfe6ea", "Lymhurst": "#7fae5c", "Bridgewatch": "#c97a3d",
    "Martlock": "#5a9bc9", "Thetford": "#a262c2", "Caerleon": "#b5533f", "Brecilien": "#4fae9b"
  };
  var API_BASE = "https://europe.albion-online-data.com/api/v2/stats";
  var LOCATIONS_PARAM = CITIES.join(",");
  var RENDER_BASE = "https://render.albiononline.com/v1/item/";

  var RRR_BASE = 0.152;   // retorno base numa cidade real (sem foco)
  var RRR_BONUS = 0.248;  // retorno quando a cidade tem o bónus de fabrico daquela categoria

  var CATEGORY_FILTERS = [
    { key: "all", label: "Todas" },
    { key: "weapon", label: "Armas" },
    { key: "head", label: "Elmos / Capuzes" },
    { key: "chest", label: "Peitorais" },
    { key: "shoes", label: "Botas" },
    { key: "offhand", label: "Offhands" },
    { key: "cape", label: "Capas" },
    { key: "bag", label: "Bolsas" },
    { key: "tool", label: "Ferramentas de recolha" },
    { key: "food", label: "Comida" },
    { key: "potion", label: "Poções" }
  ];

  var CAT_LABEL = {
    weapon: "Arma", head: "Elmo", chest: "Peitoral", shoes: "Botas", offhand: "Offhand",
    cape: "Capa", bag: "Bolsa", tool: "Ferramenta", consumable: "Consumível"
  };

  // subcategorias por categoria — chave = valor de "sub" nos dados, valor = rótulo em PT
  var SUBCAT_LABEL = {
    weapon: {
      sword: "Espada", axe: "Machado", mace: "Maça", hammer: "Martelo", spear: "Lança",
      dagger: "Adaga", knuckles: "Manoplas", bow: "Arco", crossbow: "Besta",
      quarterstaff: "Bastão (Quarterstaff)", arcanestaff: "Cajado Arcano",
      cursestaff: "Cajado Amaldiçoado", firestaff: "Cajado de Fogo", froststaff: "Cajado de Gelo",
      holystaff: "Cajado Sagrado", naturestaff: "Cajado da Natureza", shapeshifterstaff: "Cajado Metamorfo"
    },
    head: { plate_helmet: "Placas", leather_helmet: "Couro", cloth_helmet: "Pano" },
    chest: { plate_armor: "Placas", leather_armor: "Couro", cloth_armor: "Pano" },
    shoes: { plate_shoes: "Placas", leather_shoes: "Couro", cloth_shoes: "Pano" },
    offhand: { shieldtype: "Escudo", booktype: "Livro", torchtype: "Tocha" },
    tool: { ore: "Picareta (Minério)", rock: "Martelo (Pedra)", wood: "Machado (Madeira)", fiber: "Foice (Fibra)", hide: "Faca (Couro)", fish: "Cana de Pesca" }
  };

  var BONUS_INFO = [
    { city: "Fort Sterling", refine: "Madeira", craft: "Martelo, Lança, Cajado Sagrado, Peitoral de Pano, Elmo de Placas" },
    { city: "Lymhurst", refine: "Fibra", craft: "Espada, Arco, Cajado Arcano, Elmo de Couro, Botas de Couro" },
    { city: "Bridgewatch", refine: "Pedra", craft: "Besta, Adaga, Cajado Amaldiçoado, Peitoral de Placas, Botas de Pano" },
    { city: "Martlock", refine: "Couro (Hide)", craft: "Machado, Quarterstaff, Cajado de Gelo, Botas de Placas, todos os Offhands" },
    { city: "Thetford", refine: "Minério", craft: "Maça, Cajado da Natureza, Cajado de Fogo, Peitoral de Couro, Elmo de Pano" },
    { city: "Caerleon", refine: "—", craft: "Ferramentas de Coleta, Roupa Coleta,  Comida, Manoplas de Guerra, Cajado de Metamorfo " },
    { city: "Brecilien", refine: "—", craft: "Capas, Bolsas, Poções" }
  ];

  var els = {};
  ["tierChips", "categorySel", "subcatField", "subcatSel", "enchantSel", "citySel", "sortSel", "taxSeg",
   "onlyPositive", "fetchVolume", "refreshBtn", "statusLine", "resultsBody",
   "cityGrid", "detailPanel", "detailBody", "detailClose"].forEach(function (id) {
    els[id] = document.getElementById(id);
  });

  var state = {
    tiers: new Set([4, 5]),
    category: "all",
    subcat: "all",
    enchant: "all",
    city: "best",
    sort: "profit",
    tax: 0.04,
    onlyPositive: false,
    fetchVolume: true,
    priceMap: {},   // itemId -> city -> {sell_price_min, sell_price_min_date}
    volMap: {},     // itemId -> city -> count
    lastFetch: null
  };

  // ---------- render static UI ----------

  function renderCityGrid() {
    var shown = BONUS_INFO.filter(function (b) { return b.city === "Caerleon" || b.city === "Brecilien"; });
    els.cityGrid.innerHTML = shown.map(function (b) {
      var refineLine = b.refine !== "—" ? '<div class="bonus-line"><span>Refino +40%</span><b>' + b.refine + '</b></div>' : "";
      return (
        '<div class="city-card">' +
        '<h3><span class="city-dot" style="background:' + CITY_DOT[b.city] + '"></span>' + b.city + '</h3>' +
        refineLine +
        '<div class="bonus-line"><span>Fabrico +15%</span><b style="text-align:right;max-width:60%">' + b.craft + '</b></div>' +
        '</div>'
      );
    }).join("");
  }

  function renderTierChips() {
    var tiers = [4, 5, 6, 7, 8];
    els.tierChips.innerHTML = tiers.map(function (t) {
      return '<button type="button" class="chip' + (state.tiers.has(t) ? ' active' : '') + '" data-tier="' + t + '">T' + t + "</button>";
    }).join("");
    els.tierChips.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var t = parseInt(chip.dataset.tier, 10);
        if (state.tiers.has(t)) { state.tiers.delete(t); } else { state.tiers.add(t); }
        chip.classList.toggle("active");
        renderTable();
      });
    });
  }

  function renderCategorySelect() {
    els.categorySel.innerHTML = CATEGORY_FILTERS.map(function (c) {
      return '<option value="' + c.key + '">' + c.label + "</option>";
    }).join("");
  }

  // popula (ou esconde) o dropdown de subcategoria consoante a categoria escolhida
  function renderSubcatSelect() {
    var map = SUBCAT_LABEL[state.category];
    if (!map) {
      els.subcatField.hidden = true;
      state.subcat = "all";
      return;
    }
    els.subcatField.hidden = false;
    var keys = Object.keys(map);
    // ordena pelo rótulo em PT, mantém "Todas" no topo
    keys.sort(function (a, b) { return map[a].localeCompare(map[b], "pt"); });
    els.subcatSel.innerHTML = '<option value="all">Todas</option>' +
      keys.map(function (k) { return '<option value="' + k + '">' + map[k] + "</option>"; }).join("");
    els.subcatSel.value = "all";
    state.subcat = "all";
  }

  // ---------- fetching ----------

  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function collectIds() {
    var outIds = new Set();
    var matIds = new Set();
    var baseIds = new Set();
    window.RECIPES.forEach(function (it) {
      baseIds.add(it.id);
      for (var lvl = 0; lvl <= 4; lvl++) {
        var req = lvl === 0 ? it.lv0 : it["lv" + lvl];
        if (!req) continue;
        var outId = lvl === 0 ? it.id : it.id + "@" + lvl;
        outIds.add(outId);
        req.m.forEach(function (m) { matIds.add(m.id); });
      }
    });
    // recursos base necessários para estimar a cadeia de encantamento (minério/couro/fibra/
    // madeira em bruto, e as barras/couro/pano/tábua não-encantados de cada tier, usados como
    // "prevbar" em T4_METALBAR_LEVELx etc.) — não são material direto de nenhuma receita, por
    // isso têm de ser pedidos à parte.
    ["ORE", "HIDE", "FIBER", "WOOD", "METALBAR", "LEATHER", "CLOTH", "PLANKS"].forEach(function (type) {
      for (var t = 3; t <= 8; t++) matIds.add("T" + t + "_" + type);
    });
    return { outIds: Array.from(outIds), matIds: Array.from(matIds), baseIds: Array.from(baseIds) };
  }

  function fetchPricesChunk(ids) {
    var url = API_BASE + "/prices/" + ids.join(",") + ".json?locations=" + encodeURIComponent(LOCATIONS_PARAM) + "&qualities=1";
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).catch(function (e) {
      console.warn("Falha num pedido de preços:", e);
      return [];
    });
  }

  function fetchHistoryChunk(ids) {
    var url = API_BASE + "/history/" + ids.join(",") + ".json?locations=" + encodeURIComponent(LOCATIONS_PARAM) + "&time-scale=24";
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).catch(function (e) {
      console.warn("Falha num pedido de histórico:", e);
      return [];
    });
  }

  function loadData() {
    try {
      var ids = collectIds();
      var priceTargets = ids.outIds.concat(ids.matIds);
      var priceChunks = chunk(priceTargets, 180);
      var wantVolume = els.fetchVolume.checked;
      var historyChunks = wantVolume ? chunk(ids.baseIds, 150) : [];

      els.refreshBtn.disabled = true;
      setStatus("A pedir preços ao mercado (" + priceChunks.length + " pedidos" + (wantVolume ? " + " + historyChunks.length + " de histórico" : "") + ")…", "");

      var priceMap = {};
      var volMap = {};

      var pricePromises = priceChunks.map(fetchPricesChunk);
      var historyPromises = historyChunks.map(fetchHistoryChunk);

      return Promise.all(pricePromises).then(function (results) {
        results.forEach(function (rows) {
          (rows || []).forEach(function (row) {
            if (!row.item_id) return;
            if (!priceMap[row.item_id]) priceMap[row.item_id] = {};
            priceMap[row.item_id][row.city] = row;
          });
        });
        return Promise.all(historyPromises);
      }).then(function (results) {
        results.forEach(function (rows) {
          (rows || []).forEach(function (row) {
            var id = row.item_id;
            var city = row.location;
            if (!id || !city) return;
            var total = 0;
            (row.data || []).forEach(function (pt) { total += (pt.item_count || 0); });
            if (!volMap[id]) volMap[id] = {};
            volMap[id][city] = (volMap[id][city] || 0) + total;
          });
        });
        state.priceMap = priceMap;
        state.volMap = volMap;
        state.lastFetch = new Date();

        // diagnóstico: quantos ids pedidos vieram mesmo com preço, no total e só os encantados (@)
        var gotAny = 0, gotEnchant = 0, totalEnchant = 0;
        ids.outIds.forEach(function (id) {
          var isEnchant = id.indexOf("@") !== -1;
          if (isEnchant) totalEnchant++;
          var hasPrice = priceMap[id] && Object.keys(priceMap[id]).some(function (c) { return priceMap[id][c].sell_price_min > 0; });
          if (hasPrice) { gotAny++; if (isEnchant) gotEnchant++; }
        });

        setStatus(
          "Atualizado às " + state.lastFetch.toLocaleTimeString("pt-PT") + ". " +
          "Preços encontrados: " + gotAny + " de " + ids.outIds.length + " variantes de item " +
          "(encantadas .1–.4: " + gotEnchant + " de " + totalEnchant + ").",
          "ok"
        );
        els.refreshBtn.disabled = false;
        renderTable();
      }).catch(function (e) {
        console.error(e);
        setStatus("Não foi possível ir buscar os preços: " + e.message, "err");
        els.refreshBtn.disabled = false;
      });
    } catch (err) {
      console.error(err);
      setStatus("Erro ao iniciar a atualização: " + err.message, "err");
      if (els.refreshBtn) els.refreshBtn.disabled = false;
    }
  }

  function setStatus(msg, cls) {
    els.statusLine.textContent = msg;
    els.statusLine.className = "status-line" + (cls ? " " + cls : "");
  }

  // ---------- calculation ----------

  // Cadeia de encantamento de recursos (dados reais do jogo, não estimativas às cegas):
  // para obter um recurso T{n}_{TIPO}_LEVEL{l}, primeiro "transmuta-se" o recurso em bruto
  // (custa prata fixa + o recurso em bruto normal), depois refina-se com o recurso em bruto
  // encantado + 1 barra/couro/pano/tábua da tier anterior no MESMO nível de encantamento.
  var RAW_OF_REFINED = { METALBAR: "ORE", LEATHER: "HIDE", CLOTH: "FIBER", PLANKS: "WOOD" };
  var REFINE_BONUS_CITY = { ORE: "Thetford", HIDE: "Martlock", FIBER: "Lymhurst", WOOD: "Fort Sterling" };
  var RRR_REFINE_BASE = 0.152;
  var RRR_REFINE_BONUS = 0.367;
  var RAW_COUNT_BY_TIER = { 4: 2, 5: 3, 6: 4, 7: 5, 8: 5 };
  // taxa de prata (silver) de cada passo de transmutação, por tier e nível — igual para os 4 tipos de recurso
  var TRANSMUTE_FEE = {
    4: [1500, 3000, 6000, 24000],
    5: [1563, 3125, 6250, 25000],
    6: [2500, 5000, 16500, 66000],
    7: [5000, 15750, 51975, 207900],
    8: [15000, 47250, 155925, 779625]
  };

  var ENCHANT_RESOURCE_RE = /^T(\d)_(METALBAR|LEATHER|CLOTH|PLANKS|ORE|HIDE|FIBER|WOOD)_LEVEL(\d)$/;

  // custo estimado de 1 unidade de recurso em bruto encantado (ex.: T6_ORE_LEVEL2), recursivo
  function estimateRawEnchant(type, tier, level, city) {
    if (level === 0) return priceOf("T" + tier + "_" + type, city);
    var prev = level === 1 ? priceOf("T" + tier + "_" + type, city) : estimateRawEnchant(type, tier, level - 1, city);
    if (prev === null) return null;
    var fee = TRANSMUTE_FEE[tier][level - 1];
    return prev + fee; // transmutação não tem retorno de recursos (consome 100%)
  }

  // custo estimado de 1 unidade de recurso refinado encantado (ex.: T6_METALBAR_LEVEL2), recursivo pelas tiers
  function estimateRefinedEnchant(refined, tier, level, city) {
    if (level === 0) return priceOf("T" + tier + "_" + refined, city);
    var type = RAW_OF_REFINED[refined];
    var rawCost = estimateRawEnchant(type, tier, level, city);
    var prevBarCost = tier === 4
      ? priceOf("T3_" + refined, city)
      : estimateRefinedEnchant(refined, tier - 1, level, city);
    if (rawCost === null || prevBarCost === null) return null;
    var rrr = (city === REFINE_BONUS_CITY[type]) ? RRR_REFINE_BONUS : RRR_REFINE_BASE;
    var count = RAW_COUNT_BY_TIER[tier];
    return (count * rawCost + prevBarCost) * (1 - rrr);
  }

  // preço de um material: primeiro tenta o mercado; se faltar E for um recurso encantado
  // (metal/couro/pano/tábua ou o seu recurso em bruto), calcula o custo real da cadeia de
  // encantamento a partir dos preços de mercado dos recursos base. Devolve {value, estimated}.
  function materialPrice(id, city) {
    var real = priceOf(id, city);
    if (real !== null) return { value: real, estimated: false };
    var m = id.match(ENCHANT_RESOURCE_RE);
    if (!m) return null;
    var tier = parseInt(m[1], 10), type = m[2], level = parseInt(m[3], 10);
    var est = RAW_OF_REFINED[type]
      ? estimateRefinedEnchant(type, tier, level, city)
      : estimateRawEnchant(type, tier, level, city);
    return est === null ? null : { value: est, estimated: true };
  }

  function priceOf(id, city) {
    var e = state.priceMap[id] && state.priceMap[id][city];
    if (!e || !e.sell_price_min) return null;
    return e.sell_price_min;
  }

  function volOf(id, city) {
    var v = state.volMap[id] && state.volMap[id][city];
    return v === undefined ? null : v;
  }

  function computeAtCity(item, lvl, req, city) {
    var rrr = (item.city === city) ? RRR_BONUS : RRR_BASE;
    var cost = 0;
    var costComplete = true;
    var costEstimated = false;
    req.m.forEach(function (m) {
      var p = materialPrice(m.id, city);
      if (p === null) { costComplete = false; return; }
      if (p.estimated) costEstimated = true;
      cost += m.count * (1 - rrr) * p.value;
    });
    var outId = lvl === 0 ? item.id : item.id + "@" + lvl;
    var sell = priceOf(outId, city);
    if (sell === null) return null; // sem preço de venda, não há nada a mostrar
    var finalCost = costComplete ? cost : null;
    var revenue = sell * (1 - state.tax);
    var profit = finalCost !== null ? revenue - finalCost : null;
    var margin = (profit !== null && revenue > 0) ? profit / revenue : null;
    var vol = els.fetchVolume.checked ? volOf(item.id, city) : null;
    return { city: city, sell: sell, cost: finalCost, profit: profit, margin: margin, vol: vol, rrr: rrr, costComplete: costComplete, costEstimated: costEstimated };
  }

  function buildRows() {
    var rows = [];
    var enchantFilter = state.enchant;
    var catFilter = state.category;

    window.RECIPES.forEach(function (item) {
      if (!state.tiers.has(item.tier)) return;
      if (catFilter !== "all") {
        if (catFilter === "food" && !(item.cat === "consumable" && item.sub === "food")) return;
        else if (catFilter === "potion" && !(item.cat === "consumable" && item.sub === "potions")) return;
        else if (catFilter !== "food" && catFilter !== "potion" && item.cat !== catFilter) return;
      }
      if (state.subcat !== "all" && item.sub !== state.subcat) return;

      var levels = enchantFilter === "all" ? [0, 1, 2, 3, 4] : [parseInt(enchantFilter, 10)];
      levels.forEach(function (lvl) {
        var req = lvl === 0 ? item.lv0 : item["lv" + lvl];
        if (!req) return;

        if (state.city !== "best") {
          var r = computeAtCity(item, lvl, req, state.city);
          if (r && (r.costComplete || !state.onlyPositive)) rows.push(makeRow(item, lvl, r));
          return;
        }

        var candidates = [];
        CITIES.forEach(function (city) {
          var r = computeAtCity(item, lvl, req, city);
          if (r && (r.costComplete || !state.onlyPositive)) candidates.push(r);
        });
        if (candidates.length === 0) return;
        var best = candidates.reduce(function (a, b) {
          var av = a.profit === null ? -Infinity : a.profit;
          var bv = b.profit === null ? -Infinity : b.profit;
          return bv > av ? b : a;
        });
        rows.push(makeRow(item, lvl, best));
      });
    });
    return rows;
  }

  function makeRow(item, lvl, r) {
    return { item: item, lvl: lvl, r: r };
  }

  function sortRows(rows) {
    var key = state.sort;
    var field = key === "profit" ? "profit" : key === "margin" ? "margin" : key === "sell" ? "sell" : "vol";
    rows.sort(function (a, b) {
      var av = a.r[field], bv = b.r[field];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
    return rows;
  }

  // ---------- rendering ----------

  var MAX_ROWS = 300;

  function fmtSilver(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Math.round(n).toLocaleString("pt-PT");
  }
  function fmtPct(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return (n * 100).toFixed(1) + "%";
  }
  function fmtVol(n) {
    if (n === null || n === undefined) return "—";
    return n.toLocaleString("pt-PT");
  }
  function iconUrl(id) {
    return RENDER_BASE + id + ".png?size=64&quality=1";
  }

  function renderTable() {
    var rows = sortRows(buildRows());
    var total = rows.length;
    rows = rows.slice(0, MAX_ROWS);

    if (rows.length === 0) {
      els.resultsBody.innerHTML = '<tr><td colspan="7" class="empty-row">Nenhum item corresponde aos filtros (ou ainda não atualizaste os preços).</td></tr>';
      return;
    }

    var html = rows.map(function (row) {
      var item = row.item, lvl = row.lvl, r = row.r;
      var outId = lvl === 0 ? item.id : item.id + "@" + lvl;
      var enchantTag = lvl > 0 ? '<span class="pill">.' + lvl + "</span>" : "";
      var profitCls = r.profit === null ? "" : (r.profit >= 0 ? "profit-pos" : "profit-neg");
      var cityHtml = r.city
        ? '<span class="city-tag"><span class="city-dot" style="background:' + (CITY_DOT[r.city] || "#888") + '"></span>' + r.city + "</span>"
        : "—";
      return (
        '<tr data-id="' + item.id + '" data-lvl="' + lvl + '" data-city="' + (r.city || "") + '">' +
        '<td><div class="item-cell"><img class="item-icon" loading="lazy" src="' + iconUrl(outId) + '" alt=""><div><span class="item-name">' + item.name + " " + enchantTag + '</span><span class="item-sub">T' + item.tier + " · " + (CAT_LABEL[item.cat] || item.cat) + "</span></div></div></td>" +
        "<td>" + cityHtml + "</td>" +
        '<td class="num num-mono">' + fmtSilver(r.sell) + "</td>" +
        '<td class="num num-mono" title="' + (r.costEstimated ? "custo com estimativa da cadeia de encantamento (recurso encantado sem venda ativa no mercado)" : "") + '">' + (r.costComplete ? (r.costEstimated ? "≈" : "") + fmtSilver(r.cost) : "sem material") + "</td>" +
        '<td class="num num-mono ' + profitCls + '">' + fmtSilver(r.profit) + "</td>" +
        '<td class="num num-mono ' + profitCls + '">' + fmtPct(r.margin) + "</td>" +
        '<td class="num num-mono">' + fmtVol(r.vol) + "</td>" +
        "</tr>"
      );
    }).join("");

    if (total > MAX_ROWS) {
      html += '<tr><td colspan="7" class="empty-row">A mostrar os ' + MAX_ROWS + " melhores resultados de " + total + ". Afina os filtros para ver outros.</td></tr>";
    }

    els.resultsBody.innerHTML = html;
    els.resultsBody.querySelectorAll("tr[data-id]").forEach(function (tr) {
      tr.addEventListener("click", function () { openDetail(tr.dataset.id, parseInt(tr.dataset.lvl, 10), tr.dataset.city || null); });
    });
  }

  // ---------- detail panel ----------

  function openDetail(itemId, lvl, city) {
    var item = window.RECIPES.find(function (it) { return it.id === itemId; });
    if (!item) return;
    var req = lvl === 0 ? item.lv0 : item["lv" + lvl];
    var outId = lvl === 0 ? item.id : item.id + "@" + lvl;
    var useCity = city || item.city || "Fort Sterling";
    var rrr = (item.city === useCity) ? RRR_BONUS : RRR_BASE;

    var matsHtml = req.m.map(function (m) {
      var eff = m.count * (1 - rrr);
      var p = materialPrice(m.id, useCity);
      var subtotal = p !== null ? eff * p.value : null;
      var mname = window.MATERIALS[m.id] || m.id;
      var tag = p !== null && p.estimated ? " (estimado)" : "";
      return (
        "<li><span>" + mname + " — " + m.count + " (efetivo " + eff.toFixed(1) + ")</span>" +
        "<b>" + (p !== null ? fmtSilver(p.value) + tag + " → " + fmtSilver(subtotal) : "sem preço") + "</b></li>"
      );
    }).join("");

    var sell = priceOf(outId, useCity);
    var cost = null, complete = true, anyEstimated = false;
    var costSum = 0;
    req.m.forEach(function (m) {
      var p = materialPrice(m.id, useCity);
      if (p === null) { complete = false; return; }
      if (p.estimated) anyEstimated = true;
      costSum += m.count * (1 - rrr) * p.value;
    });
    cost = complete ? costSum : null;
    var revenue = sell !== null ? sell * (1 - state.tax) : null;
    var profit = (revenue !== null && cost !== null) ? revenue - cost : null;

    els.detailBody.innerHTML =
      '<div class="detail-title"><img src="' + iconUrl(outId) + '" alt="">' +
      "<div><h3>" + item.name + (lvl > 0 ? " ." + lvl : "") + "</h3>" +
      "<span>T" + item.tier + " · " + (CAT_LABEL[item.cat] || item.cat) + (item.city ? " · bónus em " + item.city : "") + "</span></div></div>" +
      "<ul class=\"detail-mats\">" + matsHtml + "</ul>" +
      '<div class="detail-grid">' +
      "<div><span>Cidade de fabrico</span><b>" + useCity + "</b></div>" +
      "<div><span>Retorno de recursos</span><b>" + (rrr * 100).toFixed(1) + "%</b></div>" +
      "<div><span>Preço de venda</span><b>" + fmtSilver(sell) + "</b></div>" +
      "<div><span>Imposto de venda</span><b>" + (state.tax * 100).toFixed(0) + "%</b></div>" +
      "<div><span>Custo de materiais</span><b>" + (anyEstimated ? "≈" : "") + fmtSilver(cost) + "</b></div>" +
      "<div><span>Foco necessário</span><b>" + fmtSilver(req.f) + "</b></div>" +
      "<div><span>Lucro estimado</span><b>" + fmtSilver(profit) + "</b></div>" +
      "<div><span>Item Power</span><b>" + (item.ip || "—") + "</b></div>" +
      "</div>" +
      '<p class="detail-note">Preços do posto de mercado em ' + useCity + " (venda mais baixa em curso). O custo assume que compras todos os materiais nessa mesma cidade — se comprares mais barato noutro sítio e transportares, o lucro real pode ser maior.</p>";

    els.detailPanel.hidden = false;
  }

  els.detailClose.addEventListener("click", function () { els.detailPanel.hidden = true; });
  els.detailPanel.addEventListener("click", function (e) { if (e.target === els.detailPanel) els.detailPanel.hidden = true; });

  // ---------- wire up controls ----------

  els.categorySel.addEventListener("change", function () {
    state.category = els.categorySel.value;
    renderSubcatSelect();
    renderTable();
  });
  els.subcatSel.addEventListener("change", function () { state.subcat = els.subcatSel.value; renderTable(); });
  els.enchantSel.addEventListener("change", function () { state.enchant = els.enchantSel.value; renderTable(); });
  els.citySel.addEventListener("change", function () { state.city = els.citySel.value; renderTable(); });
  els.sortSel.addEventListener("change", function () { state.sort = els.sortSel.value; renderTable(); });
  els.onlyPositive.addEventListener("change", function () { state.onlyPositive = els.onlyPositive.checked; renderTable(); });

  els.taxSeg.querySelectorAll(".seg-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      els.taxSeg.querySelectorAll(".seg-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      state.tax = parseFloat(btn.dataset.tax);
      renderTable();
    });
  });

  els.refreshBtn.addEventListener("click", loadData);

  // ---------- init ----------
  renderCityGrid();
  renderTierChips();
  renderCategorySelect();
  state.category = els.categorySel.value;
  renderSubcatSelect();
})();
