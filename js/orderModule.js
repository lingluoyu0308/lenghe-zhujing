// orderModule.js - 施工材料下单管理模块
// 计算公式：金额 = 数量 × 单价（保持与原系统完全一致）
// 状态：待下单(pending) / 已下单(ordered) / 已到货(arrived) / 已安装(installed)

(function () {
  const STORAGE_KEY = 'cm_order_records';
  const SEQ_KEY = 'cm_order_seq';
  let records = [];
  let editingId = null;
  let sortKey = null;
  let sortDir = 1;
  const selectedIds = new Set();

  // 家装主材·电器参考清单（八大类）
  const CATALOG = [
    { category: '一、全屋主材（基础硬装类）', subs: [
      { sub: '地面', items: ['瓷砖（客厅/厨卫/阳台）','木地板（卧室/书房）','地暖','门槛石','窗台石','踢脚线'] },
      { sub: '墙面', items: ['乳胶漆','壁纸/壁布','护墙板','木饰面','岩板/石材背景墙'] },
      { sub: '顶面', items: ['石膏板吊顶','铝扣板吊顶（厨卫阳台）','石膏线条','PU线条'] },
      { sub: '门窗', items: ['室内门（卧室/书房/卫生间）','推拉门（阳台/厨房）','窗（如需更换）','门套/窗套/垭口套','防盗门（如需换）'] },
      { sub: '五金', items: ['门锁','合页','门吸','铰链','抽屉导轨','拉手','角阀','地漏','水龙头','淋浴软管','毛巾架','置物架','厕纸架'] }
    ]},
    { category: '二、全屋电器 & 智能设备（按购买优先级）', subs: [
      { sub: '水电阶段确定', items: ['中央空调/风管机','全屋净水','热水器','智能马桶/盖','洗碗机','蒸烤箱','垃圾处理器','电动窗帘','全屋智能系统'], tag: 'priority' },
      { sub: '安装阶段', items: ['烟灶','冰箱','洗衣机','烘干机','电视','空调挂机/柜机','浴霸','灯具','智能门锁'], tag: 'priority' },
      { sub: '入住后添置', items: ['扫地机器人','空气净化器','加湿器','小家电（电饭煲/咖啡机等）','路由器','摄像头'], tag: 'priority' }
    ]},
    { category: '三、容易被忽略的小件', subs: [
      { sub: '建议一并记上', items: ['开关插座面板（全屋）','网络面板（每个房间）','暗装龙头/入墙花洒（如选暗装方案，需水电阶段预埋）','壁龛层板（卫生间砌筑时做）','检修口（吊顶内留）'] }
    ]},
    { category: '四、厨房', subs: [
      { sub: '主材', items: ['橱柜（地柜+吊柜+台面）','水槽（单槽/双槽）+ 龙头','墙砖','地砖','铝扣板吊顶','挡水条'] },
      { sub: '电器', items: ['油烟机','燃气灶','蒸烤箱 / 微蒸烤一体机','洗碗机','消毒柜（可选）','微波炉（可选）','冰箱（也可放餐厅）','燃气热水器 / 壁挂炉（如厨房安装）','垃圾处理器','净水器 / 前置过滤器'] }
    ]},
    { category: '五、卫生间', subs: [
      { sub: '主材', items: ['浴室柜（含镜柜/面盆）','马桶 / 智能马桶 / 蹲便器+水箱','花洒（顶喷+手持）','淋浴房 / 浴帘+挡水条','墙砖','地砖','铝扣板吊顶','地漏（至少2个：淋浴区+干区）','角阀、软管若干'] },
      { sub: '电器', items: ['电热水器 / 燃气热水器（如放卫生间）','浴霸（风暖/灯暖）','智能马桶盖（如选普通马桶）','镜前灯/防雾镜'] }
    ]},
    { category: '六、客餐厅 & 玄关', subs: [
      { sub: '主材', items: ['地砖 / 木地板','乳胶漆 / 壁纸','玄关柜 / 餐边柜（定制或成品）','电视背景墙材料','踢脚线'] },
      { sub: '电器', items: ['电视','空调（中央空调/柜机/风管机）','路由器','智能窗帘电机（如需）','扫地机器人 / 洗地机'] }
    ]},
    { category: '七、卧室 & 书房', subs: [
      { sub: '主材', items: ['木地板 / 地砖','乳胶漆 / 壁纸','衣柜（定制/成品）','木门','窗台石','踢脚线'] },
      { sub: '电器', items: ['空调（挂机/中央空调出风口）','床头壁灯/台灯','电动窗帘（可选）','加湿器/空气净化器（按需）'] }
    ]},
    { category: '八、阳台', subs: [
      { sub: '主材', items: ['地砖 / 防腐木','洗衣柜 / 拖把池','铝扣板吊顶（如封阳台）','地漏'] },
      { sub: '电器', items: ['洗衣机','烘干机（叠放或独立）','晾衣架（电动升降/手动/隐形晾衣绳）','洗地机充电位'] }
    ]}
  ];

  // ===== localStorage 读写 =====
  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      records = raw ? JSON.parse(raw) : [];
    } catch (e) {
      records = [];
    }
    records = records.map(r => ({
      id: r.id || nextSeq(),
      project: r.project || '',
      material: r.material || '',
      spec: r.spec || '',
      unit: r.unit || '',
      quantity: Number(r.quantity) || 0,
      expectedDate: r.expectedDate || '',
      supplier: r.supplier || '',
      contact: r.contact || '',
      unitPrice: Number(r.unitPrice) || 0,
      amount: Number(r.amount) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
      status: ['pending','ordered','arrived','installed'].includes(r.status) ? r.status : 'pending',
      remark: r.remark || ''
    }));
    saveRecords();
  }
  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
  function nextSeq() {
    let s = parseInt(localStorage.getItem(SEQ_KEY) || '0', 10) + 1;
    localStorage.setItem(SEQ_KEY, String(s));
    return s;
  }

  // ===== 工具函数 =====
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function formatNum(n) {
    n = Number(n) || 0;
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function statusLabel(s) {
    return {pending:'待下单', ordered:'已下单', arrived:'已到货', installed:'已安装'}[s] || s;
  }
  function showToast(msg) {
    const t = document.getElementById('orderToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  // ===== 日期工具 =====
  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function mondayOfThisWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  function sundayOfThisWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  // ===== 待办卡片渲染 =====
  function renderTodoCards() {
    const today = todayStr();
    const mon = mondayOfThisWeek();
    const sun = sundayOfThisWeek();
    const overdue = records.filter(r => r.status === 'pending' && r.expectedDate && r.expectedDate < today);
    const todayList = records.filter(r => r.status === 'pending' && r.expectedDate === today);
    const weekList = records.filter(r =>
      r.status === 'pending' && r.expectedDate && r.expectedDate > today &&
      r.expectedDate >= mon && r.expectedDate <= sun
    );
    const html = `
      <div class="todo-card danger-strong" onclick="orderModule.jumpToFilter('overdue')">
        <div class="count">${overdue.length}</div>
        <div class="label">已过期未下单</div>
        ${overdue.slice(0,2).map(r => `<div class="todo-list-inline">⚠ ${escapeHtml(r.material||'-')} (${r.expectedDate})</div>`).join('')}
      </div>
      <div class="todo-card danger" onclick="orderModule.jumpToFilter('today')">
        <div class="count">${todayList.length}</div>
        <div class="label">今日需下单</div>
        ${todayList.slice(0,2).map(r => `<div class="todo-list-inline">📋 ${escapeHtml(r.material||'-')}</div>`).join('')}
      </div>
      <div class="todo-card warning" onclick="orderModule.jumpToFilter('week')">
        <div class="count">${weekList.length}</div>
        <div class="label">本周需下单</div>
        ${weekList.slice(0,2).map(r => `<div class="todo-list-inline">📅 ${escapeHtml(r.material||'-')} (${r.expectedDate})</div>`).join('')}
      </div>
    `;
    document.getElementById('orderTodoCards').innerHTML = html;
  }

  function jumpToFilter(type) {
    document.getElementById('orderFilterStatus').value = 'pending';
    document.getElementById('orderSearchInput').value = '';
    window._orderTodoFilter = type;
    renderAll();
    document.getElementById('orderDataTable').scrollIntoView({ behavior: 'smooth' });
  }

  // ===== 筛选、搜索、排序 =====
  function getFiltered() {
    const status = document.getElementById('orderFilterStatus').value;
    const project = document.getElementById('orderFilterProject').value;
    const kw = document.getElementById('orderSearchInput').value.trim().toLowerCase();
    let list = records.filter(r => {
      if (status && r.status !== status) return false;
      if (project && r.project !== project) return false;
      if (kw) {
        const hay = (r.material + ' ' + r.supplier + ' ' + r.remark + ' ' + r.project + ' ' + r.spec).toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (window._orderTodoFilter) {
        const today = todayStr();
        const mon = mondayOfThisWeek();
        const sun = sundayOfThisWeek();
        if (window._orderTodoFilter === 'overdue' && !(r.status === 'pending' && r.expectedDate && r.expectedDate < today)) return false;
        if (window._orderTodoFilter === 'today' && !(r.status === 'pending' && r.expectedDate === today)) return false;
        if (window._orderTodoFilter === 'week' && !(r.status === 'pending' && r.expectedDate && r.expectedDate > today && r.expectedDate >= mon && r.expectedDate <= sun)) return false;
      }
      return true;
    });
    if (sortKey) {
      list.sort((a, b) => {
        let va = a[sortKey], vb = b[sortKey];
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
        va = String(va || ''); vb = String(vb || '');
        return va.localeCompare(vb, 'zh') * sortDir;
      });
    } else {
      list.sort((a,b) => (a.expectedDate || '9999').localeCompare(b.expectedDate || '9999'));
    }
    return list;
  }

  function setSort(key) {
    if (sortKey === key) sortDir = -sortDir;
    else { sortKey = key; sortDir = 1; }
    document.querySelectorAll('#orderModule .sort-arrow').forEach(e => e.textContent = '');
    const arrow = document.getElementById('sort-' + key);
    if (arrow) arrow.textContent = sortDir === 1 ? '↑' : '↓';
    renderAll();
  }

  function renderTable() {
    const list = getFiltered();
    const tbody = document.getElementById('orderTableBody');
    const cardView = document.getElementById('orderCardView');
    const emptyState = document.getElementById('orderEmptyState');
    if (window._orderTodoFilter) delete window._orderTodoFilter;
    if (list.length === 0) {
      tbody.innerHTML = '';
      cardView.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';
    const today = todayStr();
    tbody.innerHTML = list.map(r => {
      const rowClass = (r.status === 'pending' && r.expectedDate < today) ? 'row-overdue' :
                       (r.status === 'pending' && r.expectedDate === today) ? 'row-today' : '';
      const checked = selectedIds.has(r.id) ? 'checked' : '';
      const selClass = selectedIds.has(r.id) ? 'row-selected' : '';
      return `<tr class="${rowClass} ${selClass}">
        <td class="cb-cell"><input type="checkbox" ${checked} onchange="orderModule.toggleSelect(${r.id}, this.checked)"></td>
        <td>${escapeHtml(r.project)}</td>
        <td>${escapeHtml(r.material)}</td>
        <td>${escapeHtml(r.spec)}</td>
        <td>${escapeHtml(r.unit)}</td>
        <td>${formatNum(r.quantity)}</td>
        <td>${r.expectedDate || '-'}</td>
        <td>${escapeHtml(r.supplier)}</td>
        <td>${escapeHtml(r.contact) || '-'}</td>
        <td>¥${formatNum(r.unitPrice)}</td>
        <td>¥${formatNum(r.amount)}</td>
        <td><span class="status-badge status-${r.status}">${statusLabel(r.status)}</span></td>
        <td>${escapeHtml(r.remark)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-primary" onclick="orderModule.openEditModal(${r.id})">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="orderModule.deleteRecord(${r.id})">删除</button>
        </td>
      </tr>`;
    }).join('');
    cardView.innerHTML = list.map(r => {
      const checked = selectedIds.has(r.id) ? 'checked' : '';
      const selClass = selectedIds.has(r.id) ? 'card-selected' : '';
      return `<div class="record-card ${selClass}" style="${r.status==='pending' && r.expectedDate < today ? 'border-left:3px solid var(--danger);' : r.status==='pending' && r.expectedDate===today ? 'border-left:3px solid var(--warning);' : ''}">
        <div class="rc-checkbox" style="position:absolute;top:10px;right:10px;">
          <input type="checkbox" ${checked} onchange="orderModule.toggleSelect(${r.id}, this.checked)" title="选择此条">
        </div>
        <div class="rc-title">${escapeHtml(r.material)} <span class="status-badge status-${r.status}">${statusLabel(r.status)}</span></div>
        <div class="rc-meta">${escapeHtml(r.project)} · ${escapeHtml(r.spec)} · ${formatNum(r.quantity)}${escapeHtml(r.unit)}</div>
        <div class="rc-row"><span>预计下单</span><span>${r.expectedDate || '-'}</span></div>
        <div class="rc-row"><span>品牌/供应商</span><span>${escapeHtml(r.supplier) || '-'}</span></div>
        <div class="rc-row"><span>联系电话</span><span>${escapeHtml(r.contact) || '-'}</span></div>
        <div class="rc-row"><span>金额</span><span>¥${formatNum(r.amount)} (¥${formatNum(r.unitPrice)}/${escapeHtml(r.unit)})</span></div>
        ${r.remark ? `<div class="rc-row"><span>备注</span><span>${escapeHtml(r.remark)}</span></div>` : ''}
        <div class="rc-actions">
          <button class="btn btn-sm btn-primary" onclick="orderModule.openEditModal(${r.id})" style="flex:1;">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="orderModule.deleteRecord(${r.id})" style="flex:1;">删除</button>
        </div>
      </div>`;
    }).join('');
    syncSelectAllCheckbox(list);
  }

  function refreshProjectFilter() {
    const sel = document.getElementById('orderFilterProject');
    const cur = sel.value;
    const projects = [...new Set(records.map(r => r.project).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">全部项目</option>' +
      projects.map(p => `<option value="${escapeHtml(p)}" ${p===cur?'selected':''}>${escapeHtml(p)}</option>`).join('');
  }

  function renderStats() {
    const total = records.length;
    const pending = records.filter(r => r.status === 'pending').length;
    const ordered = records.filter(r => r.status === 'ordered').length;
    const amount = records.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    document.getElementById('orderStatTotal').textContent = total;
    document.getElementById('orderStatPending').textContent = pending;
    document.getElementById('orderStatOrdered').textContent = ordered;
    document.getElementById('orderStatAmount').textContent = '¥' + formatNum(amount);
  }

  function renderAll() {
    refreshProjectFilter();
    renderTodoCards();
    renderTable();
    renderStats();
  }

  // ===== 模态框：新增/编辑 =====
  function openAddModal() {
    editingId = null;
    document.getElementById('orderModalTitle').textContent = '新增记录';
    ['f_project','f_material','f_spec','f_unit','f_quantity','f_expectedDate','f_supplier','f_contact','f_unitPrice','f_remark']
      .forEach(id => document.getElementById(id).value = '');
    document.getElementById('f_expectedDate').value = todayStr();
    document.querySelector('input[name=orderStatus][value=pending]').checked = true;
    calcAmount();
    document.getElementById('orderEditModal').classList.add('show');
  }

  function openEditModal(id) {
    const r = records.find(x => x.id === id);
    if (!r) return;
    editingId = id;
    document.getElementById('orderModalTitle').textContent = '编辑记录';
    document.getElementById('f_project').value = r.project;
    document.getElementById('f_material').value = r.material;
    document.getElementById('f_spec').value = r.spec;
    document.getElementById('f_unit').value = r.unit;
    document.getElementById('f_quantity').value = r.quantity;
    document.getElementById('f_expectedDate').value = r.expectedDate;
    document.getElementById('f_supplier').value = r.supplier;
    document.getElementById('f_contact').value = r.contact || '';
    document.getElementById('f_unitPrice').value = r.unitPrice;
    document.getElementById('f_remark').value = r.remark;
    const radio = document.querySelector(`input[name=orderStatus][value="${r.status}"]`);
    if (radio) radio.checked = true;
    calcAmount();
    document.getElementById('orderEditModal').classList.add('show');
  }

  function closeModal() {
    document.getElementById('orderEditModal').classList.remove('show');
  }

  // 计算公式：金额 = 数量 × 单价
  function calcAmount() {
    const q = parseFloat(document.getElementById('f_quantity').value) || 0;
    const p = parseFloat(document.getElementById('f_unitPrice').value) || 0;
    document.getElementById('f_amount').textContent = '¥' + formatNum(q * p);
  }

  function saveRecord() {
    const project = document.getElementById('f_project').value.trim();
    const material = document.getElementById('f_material').value.trim();
    const expectedDate = document.getElementById('f_expectedDate').value;
    const quantity = parseFloat(document.getElementById('f_quantity').value) || 0;
    if (!project) { showToast('请填写客户/房屋'); return; }
    if (!material) { showToast('请填写主材/电器名称'); return; }
    if (!expectedDate) { showToast('请选择预计下单日期'); return; }
    if (quantity <= 0) { showToast('数量必须大于 0'); return; }
    const status = document.querySelector('input[name=orderStatus]:checked')?.value || 'pending';
    const unitPrice = parseFloat(document.getElementById('f_unitPrice').value) || 0;
    const data = {
      project,
      material,
      spec: document.getElementById('f_spec').value.trim(),
      unit: document.getElementById('f_unit').value.trim(),
      quantity,
      expectedDate,
      supplier: document.getElementById('f_supplier').value.trim(),
      contact: document.getElementById('f_contact').value.trim(),
      unitPrice,
      amount: Number((quantity * unitPrice).toFixed(2)),
      status,
      remark: document.getElementById('f_remark').value.trim()
    };
    if (editingId) {
      const idx = records.findIndex(r => r.id === editingId);
      if (idx >= 0) records[idx] = { ...records[idx], ...data };
      showToast('已更新');
    } else {
      data.id = nextSeq();
      records.push(data);
      showToast('已新增');
    }
    saveRecords();
    closeModal();
    renderAll();
  }

  // ===== 删除 =====
  function deleteRecord(id) {
    if (!confirm('确认删除此条记录？')) return;
    records = records.filter(r => r.id !== id);
    selectedIds.delete(id);
    saveRecords();
    renderAll();
    showToast('已删除');
  }

  // ===== 批量选取删除 =====
  function toggleSelect(id, checked) {
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
    updateBatchBar();
    document.querySelectorAll('#orderTableBody tr').forEach(tr => {
      const cb = tr.querySelector('.cb-cell input[type=checkbox]');
      if (cb) {
        const m = /toggleSelect\((\d+)/.exec(cb.getAttribute('onchange'));
        if (m && selectedIds.has(Number(m[1]))) tr.classList.add('row-selected');
        else tr.classList.remove('row-selected');
      }
    });
    document.querySelectorAll('#orderCardView .record-card').forEach(card => {
      const cb = card.querySelector('.rc-checkbox input[type=checkbox]');
      if (cb) {
        const m = /toggleSelect\((\d+)/.exec(cb.getAttribute('onchange'));
        if (m && selectedIds.has(Number(m[1]))) card.classList.add('card-selected');
        else card.classList.remove('card-selected');
      }
    });
  }

  function toggleSelectAll(checkbox) {
    const list = getFiltered();
    if (checkbox.checked) list.forEach(r => selectedIds.add(r.id));
    else list.forEach(r => selectedIds.delete(r.id));
    renderTable();
    updateBatchBar();
  }

  function syncSelectAllCheckbox(list) {
    const cb = document.getElementById('orderSelectAllCheckbox');
    if (!cb) return;
    if (list.length === 0) { cb.checked = false; cb.indeterminate = false; return; }
    const selectedCount = list.filter(r => selectedIds.has(r.id)).length;
    cb.checked = (selectedCount === list.length);
    cb.indeterminate = (selectedCount > 0 && selectedCount < list.length);
  }

  function updateBatchBar() {
    const bar = document.getElementById('orderBatchBar');
    document.getElementById('orderBatchCount').textContent = selectedIds.size;
    bar.classList.toggle('show', selectedIds.size > 0);
  }

  function clearSelection() {
    selectedIds.clear();
    renderTable();
    updateBatchBar();
  }

  function batchDelete() {
    if (selectedIds.size === 0) { showToast('未选择任何记录'); return; }
    if (!confirm(`确认删除选中的 ${selectedIds.size} 条记录？此操作不可撤销。`)) return;
    records = records.filter(r => !selectedIds.has(r.id));
    selectedIds.clear();
    saveRecords();
    renderAll();
    showToast('已批量删除');
  }

  // ===== 批量修改 =====
  function openBatchEditModal() {
    if (selectedIds.size === 0) { showToast('请先选择要修改的记录'); return; }
    document.getElementById('batchEditCount').textContent = selectedIds.size;
    // 重置所有字段
    const fields = ['project','supplier','contact','expectedDate','status','remark'];
    fields.forEach(f => {
      document.getElementById('batch_' + f).checked = false;
      const valEl = document.getElementById('batch_' + f + '_val');
      valEl.disabled = true;
      valEl.value = '';
    });
    document.getElementById('batch_status_val').value = 'pending';
    document.getElementById('batchEditModal').classList.add('show');
  }

  function closeBatchEditModal() {
    document.getElementById('batchEditModal').classList.remove('show');
  }

  // 勾选字段时启用/禁用对应输入框
  function toggleBatchField(field) {
    const checked = document.getElementById('batch_' + field).checked;
    const valEl = document.getElementById('batch_' + field + '_val');
    valEl.disabled = !checked;
    if (checked) valEl.focus();
  }

  function batchEdit() {
    const fields = ['project','supplier','contact','expectedDate','status','remark'];
    // 收集勾选的字段及其新值
    const updates = {};
    fields.forEach(f => {
      if (document.getElementById('batch_' + f).checked) {
        const val = document.getElementById('batch_' + f + '_val').value;
        if (f !== 'status' && !val.trim()) {
          // 非状态字段允许清空，但提示一下
        }
        updates[f] = (f === 'status') ? val : val;
      }
    });
    if (Object.keys(updates).length === 0) {
      showToast('请至少勾选一个要修改的字段');
      return;
    }
    const count = selectedIds.size;
    if (!confirm(`确认将以下修改应用到 ${count} 条记录？\n\n` + Object.entries(updates).map(([k,v]) => {
      const labelMap = {project:'项目名称',supplier:'品牌/供应商',contact:'联系电话',expectedDate:'预计下单日期',status:'状态',remark:'备注'};
      const statusMap = {pending:'待下单',ordered:'已下单',arrived:'已到货',installed:'已安装'};
      return labelMap[k] + ' → ' + (k === 'status' ? statusMap[v] : (v || '(清空)'));
    }).join('\n'))) return;

    // 执行修改
    let changed = 0;
    records.forEach(r => {
      if (selectedIds.has(r.id)) {
        Object.keys(updates).forEach(k => {
          r[k] = updates[k];
        });
        // 重新计算金额（如果修改了数量或单价，虽然这两个字段不在批量修改中，保留逻辑）
        if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
          r.amount = Number((r.quantity * r.unitPrice).toFixed(2));
        }
        changed++;
      }
    });
    saveRecords();
    renderAll();
    closeBatchEditModal();
    showToast(`已批量修改 ${changed} 条记录`);
  }

  // ===== 导出 XLSX =====
  function exportXLSX() {
    if (records.length === 0) { showToast('暂无数据可导出'); return; }
    const rows = records.map(r => ({
      '客户/房屋': r.project,
      '主材/电器': r.material,
      '规格型号': r.spec,
      '单位': r.unit,
      '数量': r.quantity,
      '预计下单日期': r.expectedDate,
      '品牌/供应商': r.supplier,
      '联系电话': r.contact || '',
      '单价(元)': r.unitPrice,
      '金额(元)': r.amount,
      '状态': statusLabel(r.status),
      '备注': r.remark
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      {wch: 18},{wch: 18},{wch: 14},{wch: 6},{wch: 10},
      {wch: 14},{wch: 16},{wch: 14},{wch: 10},{wch: 12},{wch: 10},{wch: 20}
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '家装下单表');
    const date = todayStr().replace(/-/g, '');
    XLSX.writeFile(wb, `家装主材电器下单表_${date}.xlsx`);
    showToast('已导出 XLSX');
  }

  // ===== JSON 备份/导入 =====
  function exportJSON() {
    const data = JSON.stringify(records, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = todayStr().replace(/-/g, '');
    a.download = `家装下单备份_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('已备份 JSON');
  }

  function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arr = JSON.parse(e.target.result);
        if (!Array.isArray(arr)) { showToast('文件格式不正确'); return; }
        if (!confirm(`将导入 ${arr.length} 条记录，会覆盖当前数据，确认继续？`)) return;
        records = arr.map(r => ({
          id: r.id || nextSeq(),
          project: r.project || '',
          material: r.material || '',
          spec: r.spec || '',
          unit: r.unit || '',
          quantity: Number(r.quantity) || 0,
          expectedDate: r.expectedDate || '',
          supplier: r.supplier || '',
          contact: r.contact || '',
          unitPrice: Number(r.unitPrice) || 0,
          amount: Number(r.amount) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
          status: ['pending','ordered','arrived','installed'].includes(r.status) ? r.status : 'pending',
          remark: r.remark || ''
        }));
        saveRecords();
        renderAll();
        showToast('导入成功');
      } catch (err) {
        showToast('导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // ===== 一键备份：导出下单表 + 排期表全部数据 =====
  // 用于多端同步：在A设备备份，在B设备导入即可恢复全部数据
  function exportAllBackup() {
    const backup = {
      version: 1,
      exportTime: new Date().toISOString(),
      orders: records.slice(),
      plan: window.planModule ? window.planModule.getPlanBackupData() : null
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
    a.download = `家装管理系统全量备份_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('全量备份已下载');
  }

  // ===== 统一导入入口：自动识别 JSON(全量备份) 或 XLSX(下单表) =====
  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
      importBackupJSON(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      importOrderXLSX(file);
    } else {
      showToast('不支持的文件格式，请选择 .json 或 .xlsx');
    }
    event.target.value = '';
  }

  // 导入全量备份 JSON（含下单表 + 排期表）
  function importBackupJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        // 判断是全量备份还是旧版纯下单表备份
        if (obj && obj.orders && Array.isArray(obj.orders)) {
          // 全量备份
          const orderCount = obj.orders.length;
          const hasPlan = !!obj.plan;
          if (!confirm(`检测到全量备份文件：\n\n下单记录：${orderCount} 条\n排期数据：${hasPlan ? '有' : '无'}\n\n导入将覆盖当前所有数据，确认继续？`)) return;
          // 恢复下单表
          records = obj.orders.map(r => ({
            id: r.id || nextSeq(),
            project: r.project || '',
            material: r.material || '',
            spec: r.spec || '',
            unit: r.unit || '',
            quantity: Number(r.quantity) || 0,
            expectedDate: r.expectedDate || '',
            supplier: r.supplier || '',
            contact: r.contact || '',
            unitPrice: Number(r.unitPrice) || 0,
            amount: Number(r.amount) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
            status: ['pending','ordered','arrived','installed'].includes(r.status) ? r.status : 'pending',
            remark: r.remark || ''
          }));
          saveRecords();
          // 恢复排期表
          if (hasPlan && window.planModule) {
            window.planModule.restorePlanBackup(obj.plan);
          }
          renderAll();
          showToast('全量数据恢复成功');
        } else if (Array.isArray(obj)) {
          // 旧版纯下单表备份
          if (!confirm(`检测到下单表备份（${obj.length} 条），导入将覆盖当前下单数据，确认继续？`)) return;
          records = obj.map(r => ({
            id: r.id || nextSeq(),
            project: r.project || '',
            material: r.material || '',
            spec: r.spec || '',
            unit: r.unit || '',
            quantity: Number(r.quantity) || 0,
            expectedDate: r.expectedDate || '',
            supplier: r.supplier || '',
            contact: r.contact || '',
            unitPrice: Number(r.unitPrice) || 0,
            amount: Number(r.amount) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
            status: ['pending','ordered','arrived','installed'].includes(r.status) ? r.status : 'pending',
            remark: r.remark || ''
          }));
          saveRecords();
          renderAll();
          showToast('下单表导入成功');
        } else {
          showToast('无法识别的备份文件格式');
        }
      } catch (err) {
        showToast('导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // 导入下单表 XLSX（自动带入项目名称等所有列）
  function importOrderXLSX(file) {
    if (typeof XLSX === 'undefined') {
      showToast('Excel 库未加载');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        // 读取为 JSON 对象数组，header=1 拿到二维数组，便于灵活匹配列名
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
        if (rows.length < 2) { showToast('Excel 中没有数据行'); return; }

        // 列名映射表（支持多种列名写法）
        const colMap = {
          project:    ['客户/房屋', '客户', '房屋', '项目', '项目名称', 'project'],
          material:   ['主材/电器', '主材', '电器', '材料', '材料名称', '名称', 'material'],
          spec:       ['规格型号', '规格', '型号', 'spec'],
          unit:       ['单位', 'unit'],
          quantity:   ['数量', '数量', 'quantity'],
          expectedDate: ['预计下单日期', '下单日期', '预计日期', '日期', 'expectedDate', 'date'],
          supplier:   ['品牌/供应商', '品牌', '供应商', 'supplier'],
          contact:    ['联系电话', '电话', '联系方式', 'contact'],
          unitPrice:  ['单价(元)', '单价', '价格', 'unitPrice', 'price'],
          amount:     ['金额(元)', '金额', 'amount', 'total'],
          status:     ['状态', 'status'],
          remark:     ['备注', '说明', 'remark', 'note']
        };
        const statusMap = { '待下单':'pending', '已下单':'ordered', '已到货':'arrived', '已安装':'installed' };

        // 找到表头行，匹配列名
        const headerRow = rows[0];
        const colIndex = {}; // field -> column index
        Object.keys(colMap).forEach(field => {
          const candidates = colMap[field].map(s => s.toLowerCase().trim());
          for (let i = 0; i < headerRow.length; i++) {
            const cell = String(headerRow[i] || '').toLowerCase().trim();
            if (candidates.includes(cell)) { colIndex[field] = i; break; }
          }
        });

        if (colIndex.material === undefined) {
          showToast('未找到"主材/电器"列，请检查表头');
          return;
        }

        // 解析数据行
        const newRecords = [];
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const material = String(row[colIndex.material] || '').trim();
          if (!material) continue; // 跳过空行
          const project = colIndex.project !== undefined ? String(row[colIndex.project] || '').trim() : '';
          const statusRaw = colIndex.status !== undefined ? String(row[colIndex.status] || '').trim() : '';
          const status = statusMap[statusRaw] || (['pending','ordered','arrived','installed'].includes(statusRaw) ? statusRaw : 'pending');
          let expectedDate = '';
          if (colIndex.expectedDate !== undefined) {
            const raw = row[colIndex.expectedDate];
            if (raw instanceof Date) {
              expectedDate = raw.getFullYear() + '-' + String(raw.getMonth()+1).padStart(2,'0') + '-' + String(raw.getDate()).padStart(2,'0');
            } else if (typeof raw === 'number') {
              // Excel 日期序列号
              const d = XLSX.SSF.parse_date_code(raw);
              if (d) expectedDate = d.y + '-' + String(d.m).padStart(2,'0') + '-' + String(d.d).padStart(2,'0');
            } else {
              const s = String(raw || '').trim();
              // 兼容 YYYY/MM/DD 或 YYYY-MM-DD
              const m = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
              if (m) expectedDate = m[1] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[3]).padStart(2,'0');
              else expectedDate = s;
            }
          }
          const quantity = colIndex.quantity !== undefined ? parseFloat(row[colIndex.quantity]) || 0 : 0;
          const unitPrice = colIndex.unitPrice !== undefined ? parseFloat(row[colIndex.unitPrice]) || 0 : 0;
          newRecords.push({
            project: project,
            material: material,
            spec: colIndex.spec !== undefined ? String(row[colIndex.spec] || '').trim() : '',
            unit: colIndex.unit !== undefined ? String(row[colIndex.unit] || '').trim() : '',
            quantity: quantity,
            expectedDate: expectedDate,
            supplier: colIndex.supplier !== undefined ? String(row[colIndex.supplier] || '').trim() : '',
            contact: colIndex.contact !== undefined ? String(row[colIndex.contact] || '').trim() : '',
            unitPrice: unitPrice,
            status: status,
            remark: colIndex.remark !== undefined ? String(row[colIndex.remark] || '').trim() : ''
          });
        }

        if (newRecords.length === 0) { showToast('未解析到有效数据'); return; }

        const projectNames = [...new Set(newRecords.map(r => r.project).filter(Boolean))];
        const confirmMsg = `即将导入 ${newRecords.length} 条下单记录\n` +
          (projectNames.length > 0 ? `涉及项目：${projectNames.join('、')}\n` : '') +
          '\n导入方式：追加到当前下单表（重复项自动跳过）\n确认导入？';
        if (!confirm(confirmMsg)) return;

        const result = addRecords(newRecords, { skipDuplicate: true });
        showToast(`导入完成：新增 ${result.added} 条，跳过重复 ${result.skipped} 条`);
      } catch (err) {
        showToast('Excel 导入失败：' + err.message);
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ===== 参考清单 =====
  function buildMaterialDatalist() {
    const set = new Set();
    CATALOG.forEach(cat => cat.subs.forEach(sub => sub.items.forEach(name => {
      const main = name.replace(/（.*$/,'').trim();
      if (main) set.add(main);
    })));
    const list = [...set].sort((a,b) => a.localeCompare(b,'zh'));
    document.getElementById('materialList').innerHTML =
      list.map(n => `<option value="${escapeHtml(n)}">`).join('');
  }

  function renderCatalog() {
    const html = CATALOG.map((cat, ci) => {
      const subsHtml = cat.subs.map((sub, si) => {
        const itemsHtml = sub.items.map((name, ii) => {
          const id = `cat-${ci}-${si}-${ii}`;
          return `<label class="catalog-item">
            <input type="checkbox" data-name="${escapeHtml(name)}" data-cat="${escapeHtml(cat.category)} > ${escapeHtml(sub.sub)}" id="${id}" onchange="orderModule.updateCatalogCount()">
            <span class="item-name">${escapeHtml(name)}</span>
            ${sub.tag === 'priority' ? '<span class="item-tag priority">优先</span>' : ''}
          </label>`;
        }).join('');
        return `<div class="catalog-sub">
          <div class="catalog-sub-title">${escapeHtml(sub.sub)}</div>
          <div class="catalog-items">${itemsHtml}</div>
        </div>`;
      }).join('');
      return `<div class="catalog-category">
        <div class="catalog-category-title">${escapeHtml(cat.category)}
          <span class="toggle-cat" onclick="orderModule.toggleCategory(${ci})">勾选本类</span>
        </div>
        ${subsHtml}
      </div>`;
    }).join('');
    document.getElementById('catalogBody').innerHTML = html;
    updateCatalogCount();
  }

  function toggleCategory(ci) {
    const cat = CATALOG[ci];
    const boxes = [];
    cat.subs.forEach((sub, si) => sub.items.forEach((name, ii) => {
      const el = document.getElementById(`cat-${ci}-${si}-${ii}`);
      if (el) boxes.push(el);
    }));
    const allChecked = boxes.every(b => b.checked);
    boxes.forEach(b => b.checked = !allChecked);
    const btn = document.querySelector(`#catalogBody .catalog-category:nth-child(${ci+1}) .toggle-cat`);
    if (btn) btn.textContent = allChecked ? '勾选本类' : '取消本类';
    updateCatalogCount();
  }

  function catalogSelectAll(state) {
    document.querySelectorAll('#catalogBody input[type=checkbox]').forEach(c => c.checked = state);
    document.querySelectorAll('#catalogBody .toggle-cat').forEach(b => b.textContent = state ? '取消本类' : '勾选本类');
    updateCatalogCount();
  }

  function updateCatalogCount() {
    const n = document.querySelectorAll('#catalogBody input[type=checkbox]:checked').length;
    document.getElementById('catalogCount').textContent = n;
  }

  function openCatalogModal() {
    renderCatalog();
    document.getElementById('catalogModal').classList.add('show');
  }

  function closeCatalogModal() {
    document.getElementById('catalogModal').classList.remove('show');
  }

  function catalogGoFillStep() {
    const checked = document.querySelectorAll('#catalogBody input[type=checkbox]:checked');
    if (checked.length === 0) { showToast('请先勾选项目'); return; }
    document.getElementById('fillCount').textContent = checked.length;
    document.getElementById('g_expectedDate').value = todayStr();
    document.getElementById('g_status').value = 'pending';
    document.getElementById('catalogModal').classList.remove('show');
    document.getElementById('catalogFillModal').classList.add('show');
  }

  function closeFillModal() {
    document.getElementById('catalogFillModal').classList.remove('show');
    document.getElementById('catalogModal').classList.add('show');
  }

  function catalogConfirmAdd() {
    const checked = document.querySelectorAll('#catalogBody input[type=checkbox]:checked');
    if (checked.length === 0) { showToast('未勾选任何项目'); return; }
    const gProject = document.getElementById('g_project').value.trim();
    const gExpectedDate = document.getElementById('g_expectedDate').value;
    const gStatus = document.getElementById('g_status').value;
    const gSupplier = document.getElementById('g_supplier').value.trim();
    const gContact = document.getElementById('g_contact').value.trim();
    const gRemark = document.getElementById('g_remark').value.trim();
    let added = 0;
    checked.forEach(el => {
      const name = el.dataset.name;
      const cat = el.dataset.cat;
      const remark = gRemark ? `${cat} | ${gRemark}` : cat;
      records.push({
        id: nextSeq(),
        project: gProject,
        material: name,
        spec: '',
        unit: '',
        quantity: 0,
        expectedDate: gExpectedDate,
        supplier: gSupplier,
        contact: gContact,
        unitPrice: 0,
        amount: 0,
        status: ['pending','ordered','arrived','installed'].includes(gStatus) ? gStatus : 'pending',
        remark
      });
      added++;
    });
    saveRecords();
    document.getElementById('catalogFillModal').classList.remove('show');
    ['g_project','g_expectedDate','g_supplier','g_contact','g_remark'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('g_status').value = 'pending';
    document.querySelectorAll('#catalogBody input[type=checkbox]').forEach(c => c.checked = false);
    updateCatalogCount();
    renderAll();
    showToast(`已加入 ${added} 项，请到列表中逐条补充规格/数量/单价`);
  }

  // ===== 初始化 =====
  function init() {
    loadRecords();
    buildMaterialDatalist();
    if (records.length === 0) {
      const today = todayStr();
      const mon = mondayOfThisWeek();
      records = [
        { id: nextSeq(), project: '示例·张宅全屋主材', material: '木地板', spec: '橡木原色 15mm', unit: '平', quantity: 85, expectedDate: today, supplier: '圣象', contact: '400-826-6688', unitPrice: 268, amount: 22780, status: 'pending', remark: '主卧+次卧+客厅，示例可删' },
        { id: nextSeq(), project: '示例·张宅全屋主材', material: '油烟机', spec: '侧吸式 22m³/min', unit: '台', quantity: 1, expectedDate: mon, supplier: '方太', contact: '400-889-1188', unitPrice: 4299, amount: 4299, status: 'pending', remark: '厨房电器，示例可删' },
        { id: nextSeq(), project: '示例·王府小区2-1601', material: '瓷砖(地砖)', spec: '800x800 抛釉', unit: '块', quantity: 60, expectedDate: '2020-01-01', supplier: '东鹏', contact: '400-105-6688', unitPrice: 78, amount: 4680, status: 'pending', remark: '过期未下单示例，可删' }
      ];
      saveRecords();
    }
    renderAll();
    // 事件绑定
    document.getElementById('orderEditModal').addEventListener('click', (e) => {
      if (e.target.id === 'orderEditModal') closeModal();
    });
    document.getElementById('catalogModal').addEventListener('click', (e) => {
      if (e.target.id === 'catalogModal') closeCatalogModal();
    });
    document.getElementById('catalogFillModal').addEventListener('click', (e) => {
      if (e.target.id === 'catalogFillModal') closeFillModal();
    });
    document.getElementById('dateRefModal').addEventListener('click', (e) => {
      if (e.target.id === 'dateRefModal') closeDateRefModal();
    });
    document.getElementById('batchEditModal').addEventListener('click', (e) => {
      if (e.target.id === 'batchEditModal') closeBatchEditModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeCatalogModal();
        closeFillModal();
        closeDateRefModal();
        closeBatchEditModal();
      }
    });
  }

  // ===== 从施工计划表引用日期（单条记录手动选日期） =====
  function openDateRefModal() {
    if (!window.planModule) {
      showToast('排期模块未加载');
      return;
    }
    const pt = window.planModule.getCurrentPlanType();
    const cTab = document.getElementById('refTabConstruction');
    const iTab = document.getElementById('refTabInstall');
    if (pt === 'construction') {
      cTab.classList.add('tab-active'); cTab.classList.remove('tab-normal'); cTab.style.background = '';
      iTab.classList.remove('tab-active'); iTab.classList.add('tab-normal'); iTab.style.background = '#f0f4f9';
    } else {
      iTab.classList.add('tab-active'); iTab.classList.remove('tab-normal'); iTab.style.background = '';
      cTab.classList.remove('tab-active'); cTab.classList.add('tab-normal'); cTab.style.background = '#f0f4f9';
    }
    renderDateRefList();
    document.getElementById('dateRefModal').classList.add('show');
  }

  function closeDateRefModal() {
    document.getElementById('dateRefModal').classList.remove('show');
  }

  function switchRefTab(type) {
    window.planModule.switchPlanType({ currentTarget: { dataset: { type: type } } });
    const cTab = document.getElementById('refTabConstruction');
    const iTab = document.getElementById('refTabInstall');
    if (type === 'construction') {
      cTab.classList.add('tab-active'); cTab.classList.remove('tab-normal'); cTab.style.background = '';
      iTab.classList.remove('tab-active'); iTab.classList.add('tab-normal'); iTab.style.background = '#f0f4f9';
    } else {
      iTab.classList.add('tab-active'); iTab.classList.remove('tab-normal'); iTab.style.background = '';
      cTab.classList.remove('tab-active'); cTab.classList.add('tab-normal'); cTab.style.background = '#f0f4f9';
    }
    renderDateRefList();
  }

  function renderDateRefList() {
    const groups = window.planModule.getGroupedProjects();
    const container = document.getElementById('dateRefList');
    if (!groups || groups.length === 0) {
      container.innerHTML = '<div class="empty-state"><div>暂无排期数据</div><div style="font-size:12px;margin-top:6px;">请先在"安装排期"模块设置开始日期</div></div>';
      return;
    }
    let html = '';
    groups.forEach(g => {
      const names = g.items.map(i => i.name).join('、');
      const dateLabel = g.installDate + (g.daysText ? ' · ' + g.daysText : '');
      html += '<div onclick="orderModule.pickDateFromPlan(\'' + g.installDateISO + '\',\'' + escapeHtml(names) + '\')" style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:8px;" onmouseover="this.style.background=\'#f8fbff\'" onmouseout="this.style.background=\'\'">' +
        '<div style="flex:1;"><div style="font-weight:600;font-size:14px;">' + escapeHtml(names) + '</div>' +
        (g.items.length > 0 && g.items[0].remark ? '<div style="font-size:12px;color:var(--text-light);margin-top:2px;">需下单：' + escapeHtml(g.items[0].remark) + '</div>' : '') +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0;margin-left:10px;"><div style="color:var(--primary-dark);font-weight:600;">' + g.installDate + '</div><div style="font-size:11px;color:var(--text-light);">' + g.daysText + '</div></div>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  function pickDateFromPlan(dateISO, phaseName) {
    if (!dateISO) { showToast('无效日期'); return; }
    document.getElementById('f_expectedDate').value = dateISO;
    closeDateRefModal();
    showToast('已引用：' + phaseName + ' 的日期');
  }

  // ===== 批量添加记录（供排期模块一键导入使用） =====
  function addRecords(newRecords, opts) {
    opts = opts || {};
    const skipDuplicate = opts.skipDuplicate !== false; // 默认去重
    const project = opts.project || '';
    let added = 0;
    let skipped = 0;
    newRecords.forEach(r => {
      // 去重：相同项目+材料+预计下单日期 视为重复
      if (skipDuplicate) {
        const dup = records.find(x =>
          (x.project || '') === (r.project || project || '') &&
          (x.material || '') === (r.material || '') &&
          (x.expectedDate || '') === (r.expectedDate || '')
        );
        if (dup) { skipped++; return; }
      }
      const quantity = Number(r.quantity) || 0;
      const unitPrice = Number(r.unitPrice) || 0;
      records.push({
        id: nextSeq(),
        project: r.project || project || '',
        material: r.material || '',
        spec: r.spec || '',
        unit: r.unit || '',
        quantity: quantity,
        expectedDate: r.expectedDate || '',
        supplier: r.supplier || '',
        contact: r.contact || '',
        unitPrice: unitPrice,
        amount: Number((quantity * unitPrice).toFixed(2)),
        status: r.status || 'pending',
        remark: r.remark || ''
      });
      added++;
    });
    if (added > 0) saveRecords();
    renderAll();
    return { added: added, skipped: skipped };
  }

  // 获取当前所有记录（供外部模块查重使用）
  function getAllRecords() {
    return records.slice();
  }

  // 暴露到全局
  window.orderModule = {
    init,
    openAddModal,
    openEditModal,
    closeModal,
    calcAmount,
    saveRecord,
    deleteRecord,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    batchDelete,
    openBatchEditModal,
    closeBatchEditModal,
    toggleBatchField,
    batchEdit,
    setSort,
    jumpToFilter,
    exportXLSX,
    exportJSON,
    exportAllBackup,
    importJSON,
    importData,
    openCatalogModal,
    closeCatalogModal,
    catalogGoFillStep,
    closeFillModal,
    catalogConfirmAdd,
    toggleCategory,
    catalogSelectAll,
    updateCatalogCount,
    renderAll,
    addRecords,
    getAllRecords,
    openDateRefModal,
    closeDateRefModal,
    switchRefTab,
    renderDateRefList,
    pickDateFromPlan
  };
})();
