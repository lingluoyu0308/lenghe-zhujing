// planModule.js - 项目安装计划模块
// 排期逻辑保持与原项目安装计划表完全一致：
//   - 按 groupId 分组，同组取最大天数作为该组周期
//   - 噪音组(isNoise)在开启跳过节假日时使用工作日推进
//   - 非噪音组使用自然日推进
//   - days=0 当天完成，days=0.5 半天

(function () {
  const data = {
    startDate: '',
    installStartDate: '',
    constructionStartDate: '',
    projectName: '',
    editingProjectName: false,
    projects: [],
    groupedProjects: [],
    showDatePicker: false,
    editMode: false,
    sortMode: false,
    dragIndex: -1,
    dragOverIndex: -1,
    itemHeight: 40,
    daysEditMode: false,
    skipHoliday: false,
    installSkipHoliday: false,
    constructionSkipHoliday: false,
    visibleCount: 0,
    totalCount: 0,
    showDaysModal: false,
    currentEditOrders: [],
    currentEditName: '',
    inputDaysValue: '',
    showExportModal: false,
    showExportProgress: false,
    reminderDays: 1,
    reminderTime: '09:00',
    exportAll: true,
    calendarTitle: '装修安装计划',
    exportCurrent: 0,
    exportTotal: 0,
    exportCurrentName: '',
    exportPercent: 0,
    showExportTableModal: false,
    currentPlanType: 'construction',
    showAddForm: false,
    newProjectName: '',
    newProjectDays: '1',
    newProjectRemark: '',
    newProjectIsNoise: false,
    newProjectContent: ''
  };

  let _dragIndex = -1;

  function setData(newData) {
    Object.assign(data, newData);
    saveToLocalStorage();
    render();
  }

  // ===== localStorage 读写（保持原逻辑） =====
  function saveToLocalStorage() {
    const keys = ['projectName','startDate','installStartDate','constructionStartDate',
      'skipHoliday','installSkipHoliday','constructionSkipHoliday',
      'currentPlanType','reminderDays','reminderTime','exportAll','calendarTitle'];
    keys.forEach(k => {
      try { localStorage.setItem('ppt_' + k, JSON.stringify(data[k])); } catch(e){}
    });
  }

  function loadFromLocalStorage() {
    const defaults = {
      projectName: '', startDate: '', installStartDate: '', constructionStartDate: '',
      skipHoliday: false, installSkipHoliday: false, constructionSkipHoliday: false,
      currentPlanType: 'construction',
      reminderDays: 1, reminderTime: '09:00', exportAll: true, calendarTitle: '装修安装计划'
    };
    const keys = Object.keys(defaults);
    keys.forEach(k => {
      try {
        const v = localStorage.getItem('ppt_' + k);
        if (v !== null) { data[k] = JSON.parse(v); }
      } catch(e) {}
    });
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ===== 渲染 =====
  function render() {
    const d = data;
    const app = document.getElementById('planApp');
    if (!app) return;
    let html = '';
    html += '<div class="card header-card">';
    html += '<div class="top-actions">';
    if (!d.editMode) {
      html += '<div class="top-action-btn export-calendar-action" data-action="showExportModal"><span class="top-action-icon">📅</span><span class="top-action-text">导出日历</span></div>';
      html += '<div class="top-action-btn export-table-action" data-action="showExportTableModal"><span class="top-action-icon">📊</span><span class="top-action-text">导出表格</span></div>';
      html += '<div class="top-action-btn generate-order-action" data-action="generateOrderList" style="background:#e8f0fe;color:var(--primary-dark);"><span class="top-action-icon">📦</span><span class="top-action-text">生成下单清单</span></div>';
    }
    html += '</div>';
    html += '<div class="project-name-row">';
    if (!d.editingProjectName) {
      const pn = (d.projectName || '').trim();
      html += '<div class="project-name-display'+(pn ? '' : ' placeholder')+'" data-action="startEditProjectName">'+escapeHtml(pn || '项目名称')+'</div>';
    } else {
      html += '<input class="project-name-input" id="projectNameInput" value="'+escapeHtml(d.projectName)+'" placeholder="项目名称" maxlength="30" />';
    }
    html += '</div>';
    html += '<div class="plan-type-tabs"><div class="plan-tab '+(d.currentPlanType==='construction'?'tab-active':'tab-normal')+'" data-action="switchPlanType" data-type="construction">工地施工计划表</div><div class="plan-tab '+(d.currentPlanType==='install'?'tab-active':'tab-normal')+'" data-action="switchPlanType" data-type="install">安装进度计划表</div></div>';
    const planTitle = d.currentPlanType === 'construction' ? '工地施工计划表' : '安装进度计划表';
    html += '<div class="header-title">'+planTitle+'</div>';
    html += '<div class="date-selector"><div class="date-label">开始日期</div><div style="display:flex;align-items:center;gap:8px;"><input type="date" id="startDateInput" value="'+escapeHtml(d.startDate)+'" class="date-input" /></div></div>';
    html += '<div class="header-actions"><div class="edit-btn" data-action="toggleEditMode">'+(d.editMode ? '完成编辑' : '管理项目')+'</div>';
    if (!d.editMode) html += '<div class="edit-btn edit-days-btn" data-action="toggleDaysEditMode">'+(d.daysEditMode ? '完成天数' : '修改天数')+'</div>';
    html += '</div>';
    if (!d.editMode) {
      html += '<div class="skip-holiday-row"><span class="switch-wrapper"><input type="checkbox" class="switch-input" id="skipHolidaySwitch" '+(d.skipHoliday?'checked':'')+' /><label for="skipHolidaySwitch" class="switch-label"></label></span><span class="skip-holiday-label">噪音施工跳过节假日</span></div>';
    }
    html += '</div>';

    if (d.editMode) {
      html += '<div class="card edit-card">';
      html += '<div class="edit-header"><span class="edit-title">'+(d.sortMode ? '拖拽项目调整顺序' : '选择需要施工的项目')+'</span><span class="edit-count">'+(d.sortMode ? '共 '+d.totalCount+' 项' : '已选 '+d.visibleCount+' / '+d.totalCount+' 项')+'</span></div>';
      html += '<div class="edit-actions">';
      if (!d.sortMode) { html += '<div class="edit-action-btn" data-action="selectAll">全选</div><div class="edit-action-btn" data-action="invertSelection">反选</div><div class="edit-action-btn" data-action="toggleAddForm">'+(d.showAddForm ? '收起新增' : '＋ 新增项目')+'</div>'; }
      html += '<div class="edit-action-btn '+(d.sortMode?'active':'')+'" data-action="toggleSortMode">'+(d.sortMode ? '完成排序' : '排序')+'</div>';
      html += '</div><div class="edit-list">';
      if (!d.sortMode) {
        d.projects.forEach(item => {
          html += '<div class="edit-item '+(item.visible?'':'hidden-item')+'" data-action="toggleProjectVisible" data-order="'+item.order+'"><div class="checkbox '+(item.visible?'checked':'')+'">'+(item.visible?'<span class="check-icon">✓</span>':'')+'</div><div class="edit-item-content"><span class="edit-item-name">'+item.order+'. '+escapeHtml(item.name)+'</span><span class="edit-item-days">'+(item.days===0?'当天':(item.days===0.5?'半天':item.days+'天'))+'</span></div></div>';
        });
      } else {
        html += '<div class="sort-list">';
        d.projects.forEach((item, index) => {
          html += '<div class="sort-item '+(d.dragIndex===index?'dragging':'')+' '+(d.dragOverIndex===index?'drag-over':'')+'" draggable="true" data-index="'+index+'" data-sort-item="1"><div class="sort-handle">⠿</div><div class="sort-item-content"><span class="sort-item-name">'+(index+1)+'. '+escapeHtml(item.name)+'</span><span class="sort-item-days">'+(item.days===0?'当天':(item.days===0.5?'半天':item.days+'天'))+'</span></div><div class="sort-arrows"><div class="sort-arrow-btn '+(index===0?'disabled':'')+'" data-action="moveItemUp" data-index="'+index+'">▲</div><div class="sort-arrow-btn '+(index===d.totalCount-1?'disabled':'')+'" data-action="moveItemDown" data-index="'+index+'">▼</div></div></div>';
        });
        html += '</div>';
      }
      html += '</div>';
      if (d.showAddForm) {
        html += '<div class="add-project-section">';
        html += '<div class="add-project-form">';
        html += '<div class="add-form-title">添加新项目</div>';
        html += '<div class="add-form-row"><label class="add-form-label">项目名称 <span class="required">*</span></label><input class="add-form-input add-name-input" data-action="setNewProjectField" data-field="newProjectName" value="'+escapeHtml(d.newProjectName)+'" placeholder="请输入项目名称" maxlength="50" /></div>';
        html += '<div class="add-form-row"><label class="add-form-label">工期（天） <span class="required">*</span></label><input class="add-form-input add-days-input" type="number" step="0.5" min="0" data-action="setNewProjectField" data-field="newProjectDays" value="'+escapeHtml(d.newProjectDays)+'" placeholder="0=当天，0.5=半天" /></div>';
        html += '<div class="add-form-row"><label class="add-form-label">备注</label><input class="add-form-input add-remark-input" data-action="setNewProjectField" data-field="newProjectRemark" value="'+escapeHtml(d.newProjectRemark)+'" placeholder="选填：下单内容/注意事项" maxlength="200" /></div>';
        if (d.currentPlanType === 'construction') {
          html += '<div class="add-form-row"><label class="add-form-label">工作内容</label><input class="add-form-input add-content-input" data-action="setNewProjectField" data-field="newProjectContent" value="'+escapeHtml(d.newProjectContent)+'" placeholder="选填：施工工作内容" maxlength="300" /></div>';
        }
        html += '<div class="add-form-row add-form-noise"><label class="add-form-checkbox-label"><input type="checkbox" class="add-form-checkbox" data-action="setNewProjectField" data-field="newProjectIsNoise" '+(d.newProjectIsNoise?'checked':'')+' /> &nbsp;噪音施工（跳过节假日时会自动顺延）</label></div>';
        html += '<div class="add-form-buttons"><div class="modal-btn modal-cancel" data-action="toggleAddForm">取消</div><div class="modal-btn modal-confirm" data-action="addNewProject">确认添加</div></div>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
    } else {
      if (d.currentPlanType === 'install') {
        html += '<div class="card table-card"><div class="table-scroll"><div class="table-wrapper">';
        html += '<div class="table-row header-row"><div class="cell col-order">安装顺序</div><div class="cell col-product">产品</div><div class="cell col-date">安装日期</div><div class="cell col-days">施工周期/天</div><div class="cell col-remark">备注</div></div>';
        d.groupedProjects.forEach(group => {
          html += '<div class="table-row data-row"><div class="cell col-order">'+group.orderText+'</div><div class="cell col-product">';
          group.items.forEach(proj => { html += '<span class="multi-line">'+escapeHtml(proj.name)+'</span>'; });
          html += '</div><div class="cell col-date">'+group.installDate+'</div><div class="cell col-days">';
          if (d.daysEditMode) {
            html += '<div class="days-edit-cell" data-action="onDaysCellTap" data-orders="'+JSON.stringify(group.orders)+'"><span class="days-text">'+group.daysText+'</span><span class="days-edit-icon">✎</span></div>';
          } else html += group.daysText;
          html += '</div><div class="cell col-remark">';
          group.items.forEach(proj => { html += '<span class="multi-line">'+escapeHtml(proj.remark||'')+'</span>'; });
          html += '</div></div>';
        });
        html += '</div></div></div>';
      } else {
        html += '<div class="card table-card"><div class="table-scroll"><div class="table-wrapper construction-table">';
        html += '<div class="table-row header-row"><div class="cell col-construction-order">序号</div><div class="cell col-construction-name">施工工序</div><div class="cell col-construction-content">工作内容</div><div class="cell col-construction-date">计划日期</div><div class="cell col-construction-days">计划工期</div><div class="cell col-construction-remark">需下单内容</div></div>';
        d.groupedProjects.forEach(group => {
          html += '<div class="table-row data-row"><div class="cell col-construction-order">'+group.orderText+'</div><div class="cell col-construction-name">';
          group.items.forEach(proj => { html += '<span class="multi-line">'+escapeHtml(proj.name)+'</span>'; });
          html += '</div><div class="cell col-construction-content">';
          group.items.forEach(proj => { html += '<span class="multi-line">'+escapeHtml(proj.content||'')+'</span>'; });
          html += '</div><div class="cell col-construction-date">'+group.installDate+'</div><div class="cell col-construction-days">';
          if (d.daysEditMode) {
            html += '<div class="days-edit-cell" data-action="onDaysCellTap" data-orders="'+JSON.stringify(group.orders)+'"><span class="days-text">'+group.daysText+'</span><span class="days-edit-icon">✎</span></div>';
          } else html += group.daysText;
          html += '</div><div class="cell col-construction-remark">';
          group.items.forEach(proj => { html += '<span class="multi-line">'+escapeHtml(proj.remark||'')+'</span>'; });
          html += '</div></div>';
        });
        html += '</div></div></div>';
      }
      if (d.groupedProjects && d.groupedProjects.length > 0) {
        if (d.currentPlanType === 'install') {
          html += '<div class="card summary-card"><div class="summary-title">计划摘要</div><div class="summary-content"><div class="summary-item"><span class="summary-label">施工项目：</span><span class="summary-value">'+d.visibleCount+' 项</span></div><div class="summary-item"><span class="summary-label">开始日期：</span><span class="summary-value">'+d.groupedProjects[0].installDate+'</span></div><div class="summary-item"><span class="summary-label">预计完成：</span><span class="summary-value">'+d.groupedProjects[d.groupedProjects.length-1].endDate+'</span></div></div></div>';
        } else {
          html += '<div class="card summary-card"><div class="summary-title">计划摘要（原始天数以100㎡计算）</div><div class="summary-content"><div class="summary-item"><span class="summary-label">施工项目：</span><span class="summary-value">'+d.visibleCount+' 项</span></div><div class="summary-item"><span class="summary-label">开始日期：</span><span class="summary-value">'+d.groupedProjects[0].installDate+'</span></div><div class="summary-item summary-item-wrap"><span class="summary-label">预计完成：</span><span class="summary-value">'+d.groupedProjects[d.groupedProjects.length-1].endDate+'<span class="summary-note">（注：施工过程中存在交叉施工请自行加减天数）</span></span></div></div></div>';
        }
      }
    }
    if (d.showDaysModal) {
      html += '<div class="modal-mask" id="daysModalMask"><div class="modal-content" id="daysModalContent"><div class="modal-title">修改施工周期</div><div class="modal-project-name">'+escapeHtml(d.currentEditName)+'</div><div class="modal-input-row"><input class="modal-input" id="inputDaysValue" type="number" step="0.5" min="0" value="'+escapeHtml(d.inputDaysValue)+'" placeholder="请输入天数" /><span class="modal-unit">天</span></div><div class="modal-tips">支持小数（0.5=半天，0=当天完成）</div><div class="modal-buttons"><div class="modal-btn modal-cancel" data-action="closeDaysModal">取消</div><div class="modal-btn modal-confirm" data-action="confirmDaysChange">确定</div></div></div></div>';
    }

    if (d.showExportModal) {
      html += '<div class="modal-mask" id="exportModalMask"><div class="modal-content modal-content-large" id="exportModalContent"><div class="modal-title">导出 ICS 日历文件</div><div class="export-desc">生成标准 .ics 日历文件，可导入 Outlook / Google 日历 / Apple 日历等</div>';
      html += '<div class="export-section"><div class="section-title">提醒设置</div><div class="reminder-options">';
      [0,1,3,7].forEach(days => {
        html += '<div class="reminder-item '+(d.reminderDays===days?'reminder-active':'')+'" data-action="setReminderDays" data-days="'+days+'"><span class="reminder-check">'+(d.reminderDays===days?'✓':'')+'</span><span>'+(days===0?'不提醒':'提前'+days+'天')+'</span></div>';
      });
      html += '</div></div>';
      html += '<div class="export-section"><div class="section-title">提醒时间</div><input type="time" id="reminderTimeInput" value="'+escapeHtml(d.reminderTime)+'" class="time-picker-input" /></div>';
      html += '<div class="export-section"><div class="section-title">导出范围</div><div class="export-options"><div class="export-option '+(d.exportAll?'reminder-active':'')+'" data-action="setExportAll" data-value="true"><span class="reminder-check">'+(d.exportAll?'✓':'')+'</span><span>全部项目（'+d.visibleCount+'项）</span></div><div class="export-option '+(!d.exportAll?'reminder-active':'')+'" data-action="setExportAll" data-value="false"><span class="reminder-check">'+(!d.exportAll?'✓':'')+'</span><span>仅有待办备注的项目</span></div></div></div>';
      html += '<div class="export-section"><div class="section-title">日历标题</div><input class="export-title-input" id="calendarTitleInput" value="'+escapeHtml(d.calendarTitle)+'" placeholder="请输入日历标题" /></div>';
      html += '<div class="modal-buttons"><div class="modal-btn modal-cancel" data-action="closeExportModal">取消</div><div class="modal-btn modal-confirm" data-action="confirmExport">开始导出</div></div>';
      html += '<div class="export-tips">导出后双击 .ics 文件即可导入系统日历</div>';
      html += '</div></div>';
    }
    if (d.showExportProgress) {
      html += '<div class="modal-mask"><div class="modal-content modal-content-small"><div class="modal-title">正在导出</div><div class="progress-info"><span class="progress-count">'+d.exportCurrent+' / '+d.exportTotal+'</span><span class="progress-name">'+escapeHtml(d.exportCurrentName)+'</span></div><div class="progress-bar"><div class="progress-bar-inner" style="width: '+d.exportPercent+'%"></div></div></div></div>';
    }

    if (d.showExportTableModal) {
      html += '<div class="modal-mask" id="exportTableModalMask"><div class="modal-content" id="exportTableModalContent"><div class="modal-title">导出表格</div><div class="export-desc">选择导出方式，将安装计划表分享或保存</div>';
      html += '<div class="export-table-options">';
      html += '<div class="export-table-option" data-action="exportExcel"><div class="export-option-icon excel-icon">📊</div><div class="export-option-info"><div class="export-option-title">导出Excel文件</div><div class="export-option-desc">生成 .xlsx 文件，可用 Excel / WPS 打开</div></div><div class="export-option-arrow">›</div></div>';
      html += '<div class="export-table-option" data-action="copyTableText"><div class="export-option-icon copy-icon">📋</div><div class="export-option-info"><div class="export-option-title">复制文本</div><div class="export-option-desc">复制为制表符分隔文本，可直接粘贴到Excel</div></div><div class="export-option-arrow">›</div></div>';
      html += '<div class="export-table-option" data-action="saveTableImage"><div class="export-option-icon image-icon">🖼️</div><div class="export-option-info"><div class="export-option-title">保存为图片</div><div class="export-option-desc">将表格生成图片保存为PNG文件</div></div><div class="export-option-arrow">›</div></div>';
      html += '</div><div class="modal-buttons"><div class="modal-btn modal-cancel" data-action="closeExportTableModal">取消</div></div></div></div>';
    }

    app.innerHTML = html;
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    const app = document.getElementById('planApp');
    if (!app) return;
    const self = window.planModule;
    app.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const fn = self[t.dataset.action];
      if (fn) fn.call(self, { currentTarget: { dataset: t.dataset }, detail: { value: e.target.value } });
    });

    document.addEventListener('change', (e) => {
      if (e.target) {
        const t = e.target.closest('[data-action="setNewProjectField"]');
        if (t) {
          const field = t.dataset.field;
          if (t.type === 'checkbox') {
            setNewProjectField({ currentTarget: { dataset: t.dataset }, detail: { value: t.checked }, target: t });
          } else {
            setNewProjectField({ currentTarget: { dataset: t.dataset }, detail: { value: t.value }, target: t });
          }
          return;
        }
      }
      if (e.target && e.target.id === 'startDateInput') { onStartDateChange({ detail: { value: e.target.value } }); return; }
      if (e.target && e.target.id === 'skipHolidaySwitch') { onSkipHolidayChange({ detail: { value: e.target.checked } }); return; }
      if (e.target && e.target.id === 'reminderTimeInput') { data.reminderTime = e.target.value; saveToLocalStorage(); return; }
      if (e.target && e.target.id === 'calendarTitleInput') { data.calendarTitle = e.target.value; saveToLocalStorage(); return; }
    });
    document.addEventListener('input', (e) => {
      if (!e.target) return;
      const t = e.target.closest('[data-action="setNewProjectField"]');
      if (t && t.type !== 'checkbox') {
        setNewProjectField({ currentTarget: { dataset: t.dataset }, detail: { value: t.value }, target: t });
      }
    });

    document.addEventListener('blur', (e) => {
      if (e.target && e.target.id === 'projectNameInput') { onProjectNameChange({ detail: { value: e.target.value } }); return; }
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.target && e.target.id === 'projectNameInput' && e.key === 'Enter') { e.target.blur(); return; }
      if (e.target && e.target.id === 'inputDaysValue' && e.key === 'Enter') { confirmDaysChange(); return; }
    });

    // 触摸拖拽排序
    let touchTimer = null;
    let isDragging = false;
    let touchDragEl = null;

    app.addEventListener('touchstart', (e) => {
      if (!data.sortMode) return;
      const t = e.target.closest('[data-sort-item]');
      if (!t) return;
      const idx = parseInt(t.dataset.index, 10);
      touchTimer = setTimeout(() => {
        isDragging = true;
        touchDragEl = t;
        _dragIndex = idx;
        data.dragIndex = idx;
        t.classList.add('dragging');
        if (navigator.vibrate) navigator.vibrate(30);
      }, 400);
    }, { passive: true });

    app.addEventListener('touchmove', (e) => {
      if (!isDragging || _dragIndex < 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!targetEl) return;
      const sortItem = targetEl.closest('[data-sort-item]');
      if (!sortItem) return;
      const idx = parseInt(sortItem.dataset.index, 10);
      if (data.dragOverIndex !== idx) {
        data.dragOverIndex = idx;
        render();
      }
    }, { passive: false });

    app.addEventListener('touchend', (e) => {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      if (!isDragging) return;
      isDragging = false;
      const dragIdx = _dragIndex;
      const dropIdx = data.dragOverIndex;
      if (touchDragEl) { touchDragEl.classList.remove('dragging'); touchDragEl = null; }
      if (dragIdx >= 0 && dropIdx >= 0 && dragIdx !== dropIdx) {
        const arr = data.projects.slice();
        const moved = arr.splice(dragIdx, 1)[0];
        arr.splice(dropIdx, 0, moved);
        data.projects = arr;
      }
      data.dragIndex = -1;
      data.dragOverIndex = -1;
      _dragIndex = -1;
      saveToLocalStorage();
      render();
    }, { passive: true });

    app.addEventListener('touchcancel', () => {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      isDragging = false;
      if (touchDragEl) { touchDragEl.classList.remove('dragging'); touchDragEl = null; }
      data.dragIndex = -1;
      data.dragOverIndex = -1;
      _dragIndex = -1;
      render();
    }, { passive: true });
  }

  // ===== 初始化 =====
  function onLoad() {
    try { loadFromLocalStorage(); } catch(e) {}
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const dd = String(today.getDate()).padStart(2,'0');
    const todayStr = yyyy + '-' + mm + '-' + dd;
    initProjects();
    if (!data.startDate) data.startDate = todayStr;
    if (!data.constructionStartDate) data.constructionStartDate = todayStr;
    if (!data.installStartDate) data.installStartDate = todayStr;
    if (!data.projectName) data.projectName = '';
    if (data.currentPlanType === 'construction') {
      if (!data.skipHoliday) data.skipHoliday = !!data.constructionSkipHoliday;
    } else {
      if (!data.skipHoliday) data.skipHoliday = !!data.installSkipHoliday;
    }
    saveToLocalStorage();
    calculateDates();
    render();
  }

  function initProjects() {
    if (data.currentPlanType === 'install') initInstallProjects();
    else initConstructionProjects();
  }

  // 安装进度计划表项目（保持原数据）
  function initInstallProjects() {
    const arr = [];
    arr.push({ order: 1, name: '基础施工竣工验收', days: 0, remark: '验收后可能需要整改2天左右', groupId: 1, visible: true });
    arr.push({ order: 2, name: '淋浴房隔断测量', days: 1, remark: '', groupId: 1, visible: true });
    arr.push({ order: 3, name: '隐藏窗帘轨道测量', days: 0, remark: '', groupId: 1, visible: true });
    arr.push({ order: 4, name: '空调风口&面板安装', days: 0, remark: '', groupId: 9, visible: true });
    arr.push({ order: 5, name: '开荒保洁&局部整改', days: 1, remark: '', groupId: 3, visible: true });
    arr.push({ order: 6, name: '瓷砖美缝', days: 2, remark: '美缝前，现场最好做保洁', groupId: 4, visible: true });
    arr.push({ order: 7, name: '天然气改造', days: 0, remark: '现场需要收取耗材费用', groupId: 5, isNoise: true, visible: true });
    arr.push({ order: 8, name: '吊顶安装', days: 1, remark: '风管及止逆阀，注意密封要处理好。', groupId: 5, isNoise: true, visible: true });
    arr.push({ order: 9, name: '燃气热水器安装', days: 0.5, remark: '现场需要收取耗材费用', groupId: 6, isNoise: true, visible: true });
    arr.push({ order: 10, name: '木地板安装', days: 1, remark: '', groupId: 7, isNoise: true, visible: true });
    arr.push({ order: 11, name: '壁布壁纸铺贴', days: 1, remark: '', groupId: 8, visible: true });
    arr.push({ order: 12, name: '全屋定制柜子安装', days: 4, remark: '', groupId: 9, isNoise: true, visible: true });
    arr.push({ order: 13, name: '灯具及开关插座安装', days: 1, remark: '', groupId: 10, isNoise: true, visible: true });
    arr.push({ order: 14, name: '卫浴柜子&五金安装', days: 1, remark: '', groupId: 11, isNoise: true, visible: true });
    arr.push({ order: 15, name: '二次保洁', days: 1, remark: '', groupId: 12, visible: true });
    arr.push({ order: 16, name: '电器安装&厨房龙头下水安装', days: 1, remark: '', groupId: 13, isNoise: true, visible: true });
    arr.push({ order: 17, name: '木门及踢脚线安装', days: 2, remark: '提前准备好自己想要使用的胶', groupId: 14, isNoise: true, visible: true });
    arr.push({ order: 18, name: '水系统安装', days: 0, remark: '提前准备好洗衣机龙头及角阀', groupId: 15, visible: true });
    arr.push({ order: 19, name: '洗碗机安装', days: 0, remark: '', groupId: 15, visible: true });
    arr.push({ order: 20, name: '淋浴房安装', days: 0, remark: '', groupId: 15, isNoise: true, visible: true });
    arr.push({ order: 21, name: '马桶安装', days: 1, remark: '', groupId: 15, visible: true });
    arr.push({ order: 22, name: '洗衣机安装', days: 0, remark: '', groupId: 15, visible: true });
    arr.push({ order: 23, name: '卫生间水龙头及花洒安装', days: 0, remark: '', groupId: 15, isNoise: true, visible: true });
    arr.push({ order: 24, name: '开荒保洁', days: 1, remark: '', groupId: 16, visible: true });
    arr.push({ order: 25, name: '窗帘安装', days: 0.5, remark: '', groupId: 17, isNoise: true, visible: true });
    arr.push({ order: 26, name: '智能门锁安装', days: 0.5, remark: '', groupId: 17, visible: true });
    arr.push({ order: 27, name: '全屋统一收胶', days: 0.5, remark: '', groupId: 17, visible: true });
    arr.push({ order: 28, name: '竣工验收', days: 2, remark: '', groupId: 18, visible: true });
    data.projects = arr;
  }

  // 工地施工计划表项目（保持原数据）
  function initConstructionProjects() {
    const arr = [];
    arr.push({ order: 1, name: '工地开工', days: 2, remark: '定制柜初步方案确定、新风、空调、地暖、热水器、全屋智能、全屋净水系统、窗户、防盗门、钢结构', groupId: 1, content: '图纸交底、原房检测、水电布置定位（通知橱柜、主材供应商到场定位下单）', visible: true });
    arr.push({ order: 2, name: '拆除施工', days: 7, remark: '瓷砖、地砖', groupId: 2, content: '敲墙清理垃圾施工、原始装饰层清理干净', isNoise: true, visible: true });
    arr.push({ order: 3, name: '瓦工进场施工', days: 2, remark: '沙石水泥、隐框门', groupId: 3, content: '砌墙、粉墙（复测，同步施工图）', isNoise: true, visible: true });
    arr.push({ order: 4, name: '厂家进场施工', days: 5, remark: '水电材料', groupId: 4, content: '钢结构、地暖、新风、中央空调全屋智能、窗户、防盗门进场施工', isNoise: true, visible: true });
    arr.push({ order: 5, name: '水电工进场施工', days: 10, remark: '大理石、门槛石', groupId: 5, content: '开槽、布线、布管、试压、检测\n卫生间、厨房防水施工\n做闭水实验（48小时）', isNoise: true, visible: true });
    arr.push({ order: 6, name: '隐蔽工程验收', days: 1, remark: '成品家具', groupId: 6, content: '质量验收、客户签字、设备厂家核验', visible: true });
    arr.push({ order: 7, name: '木工进场', days: 10, remark: '墙纸、艺术漆、地漏、淋浴防滑石', groupId: 7, content: '电视背景、木工结构、吊顶（隐框门进场预埋）', isNoise: true, visible: true });
    arr.push({ order: 8, name: '中期验收', days: 1, remark: '卫生间洁具、卫浴\n全屋定制复尺', groupId: 8, content: '质量验收、交中期款', visible: true });
    arr.push({ order: 9, name: '瓦工进场施工', days: 15, remark: '', groupId: 9, content: '墙砖、地砖施工', isNoise: true, visible: true });
    arr.push({ order: 10, name: '油工进场施工', days: 15, remark: '电器类', groupId: 10, content: '涂料油漆施工', visible: true });
    arr.push({ order: 11, name: '完工验收', days: 1, remark: '', groupId: 11, content: '整体验收、交尾款、发保修卡', visible: true });
    data.projects = arr;
  }

  // ===== 核心排期逻辑（保持与原系统完全一致） =====
  function calculateDates() {
    const du = window.dateUtils;
    const startDateStr = data.startDate;
    if (!startDateStr) { data.groupedProjects = []; return; }

    const startDate = new Date(startDateStr);
    let currentDate = new Date(startDate);
    const skipHoliday = !!data.skipHoliday;

    if (skipHoliday) {
      currentDate = du.skipToWorkday(currentDate);
    }

    const visibleProjects = data.projects.filter(p => p.visible !== false);

    // 按 groupId 分组，保持首次出现顺序
    const groupedProjectsMap = {};
    const groupOrderList = [];
    visibleProjects.forEach(project => {
      if (!groupedProjectsMap[project.groupId]) {
        groupedProjectsMap[project.groupId] = [];
        groupOrderList.push(project.groupId);
      }
      groupedProjectsMap[project.groupId].push(project);
    });

    const groupedData = [];
    let groupIndex = 0;

    groupOrderList.forEach(groupId => {
      groupIndex++;
      const group = groupedProjectsMap[groupId];
      // 同组内取最大天数作为该组的施工周期
      const maxDays = Math.max(...group.map(p => p.days));
      // 噪音组：组内任意项目标记为噪音即视为噪音组
      const isNoiseGroup = group.some(p => p.isNoise === true);
      const needSkipHoliday = skipHoliday && isNoiseGroup;

      if (needSkipHoliday) {
        currentDate = du.skipToWorkday(currentDate);
      }

      const dateStr = du.formatDateShort(currentDate);
      const dateISO = currentDate.getFullYear() + '-' + String(currentDate.getMonth()+1).padStart(2,'0') + '-' + String(currentDate.getDate()).padStart(2,'0');

      const items = group.map(p => ({
        order: p.order,
        name: p.name,
        remark: p.remark || '',
        content: p.content || ''
      }));

      const orderText = String(groupIndex);
      const orders = group.map(p => p.order);
      const daysText = maxDays === 0 ? '' : (maxDays === 0.5 ? '半天' : maxDays + '天');

      // 结束日期计算
      let endDate;
      if (maxDays > 0) {
        if (needSkipHoliday) {
          endDate = du.formatDateShort(du.addWorkDays(currentDate, Math.ceil(maxDays) - 1));
        } else {
          endDate = du.formatDateShort(du.addDays(currentDate, Math.ceil(maxDays) - 1));
        }
      } else {
        endDate = dateStr;
      }

      groupedData.push({
        orderText: orderText,
        orders: orders,
        items: items,
        installDate: dateStr,
        installDateISO: dateISO,
        daysText: daysText,
        endDate: endDate
      });

      // 日期推进
      if (maxDays > 0) {
        if (needSkipHoliday) {
          currentDate = du.addWorkDays(currentDate, Math.ceil(maxDays));
        } else {
          currentDate = du.addDays(currentDate, Math.ceil(maxDays));
        }
      } else {
        currentDate = du.addDays(currentDate, 1);
      }
    });

    data.groupedProjects = groupedData;
    data.visibleCount = data.projects.filter(p => p.visible !== false).length;
    data.totalCount = data.projects.length;
  }

  // ===== 操作方法（保持原逻辑） =====
  function switchPlanType(e) {
    const t = e.currentTarget.dataset.type;
    if (data.currentPlanType === t) return;
    if (data.currentPlanType === 'construction') data.constructionStartDate = data.startDate;
    if (data.currentPlanType === 'construction') data.constructionSkipHoliday = !!data.skipHoliday;
    if (data.currentPlanType === 'install') data.installStartDate = data.startDate;
    if (data.currentPlanType === 'install') data.installSkipHoliday = !!data.skipHoliday;
    data.currentPlanType = t;
    initProjects();
    if (t === 'construction') data.startDate = data.constructionStartDate;
    if (t === 'install') data.startDate = data.installStartDate;
    if (t === 'construction') data.skipHoliday = !!data.constructionSkipHoliday;
    if (t === 'install') data.skipHoliday = !!data.installSkipHoliday;
    data.daysEditMode = false; data.editMode = false; data.sortMode = false;
    saveToLocalStorage(); calculateDates(); render();
  }

  // ===== 从施工计划表一键生成下单清单 =====
  // 逻辑：遍历当前排期表的每个工序，解析"需下单内容"(remark)字段，
  //       以该工序的排期日期作为预计下单日期，批量写入材料下单表。
  // 注意：仅工地施工计划表有"需下单内容"列；安装进度计划表的"备注"列为施工注意事项，
  //       不作为下单材料解析，避免误生成。
  function generateOrderList() {
    if (!window.orderModule) {
      alert('材料下单模块未加载，无法生成下单清单');
      return;
    }
    // 安装进度表的"备注"列是施工注意事项，不是需下单内容，不生成下单清单
    if (data.currentPlanType === 'install') {
      alert('安装进度计划表无"需下单内容"列。\n\n如需生成下单清单，请切换到【工地施工计划表】，在"需下单内容"列填写需要下单的材料。');
      return;
    }
    const groups = data.groupedProjects || [];
    if (groups.length === 0) {
      alert('当前排期表暂无数据，请先设置开始日期');
      return;
    }
    const projectName = (data.projectName || '').trim();

    // 收集所有需下单的材料
    const newRecords = [];
    let totalMaterials = 0;
    let phasesWithOrder = 0;

    groups.forEach(group => {
      const orderDate = group.installDateISO || '';
      if (!orderDate) return;
      group.items.forEach(item => {
        const remark = (item.remark || '').trim();
        if (!remark) return;
        // 需下单内容可能以中文逗号、英文逗号、顿号、分号、换行分隔
        const materials = remark.split(/[、,，;；\n\r]+/).map(s => s.trim()).filter(s => s.length > 0);
        if (materials.length === 0) return;
        phasesWithOrder++;
        materials.forEach(mat => {
          newRecords.push({
            project: projectName,
            material: mat,
            expectedDate: orderDate,
            status: 'pending',
            remark: '【工地施工】' + item.name + '（' + group.installDate + '）'
          });
          totalMaterials++;
        });
      });
    });

    if (totalMaterials === 0) {
      alert('当前排期表中没有"需下单内容"，无法生成下单清单。\n请先在施工计划表的"需下单内容"列填写需要下单的材料。');
      return;
    }

    const confirmMsg = '即将从【工地施工计划表】生成下单清单：\n\n' +
      '涉及工序：' + phasesWithOrder + ' 个\n' +
      '下单材料：' + totalMaterials + ' 项\n' +
      '下单日期：按各工序排期日期自动填入\n\n' +
      '是否继续？（重复材料会自动跳过）';

    if (!confirm(confirmMsg)) return;

    const result = window.orderModule.addRecords(newRecords, { project: projectName });

    if (result.added > 0) {
      alert('下单清单生成成功！\n\n新增：' + result.added + ' 项\n跳过重复：' + result.skipped + ' 项\n\n已跳转到材料下单模块，请补充数量、单价等信息。');
      // 切换到材料下单模块
      if (typeof switchModule === 'function') {
        switchModule('order');
      }
    } else {
      alert('没有新增记录（' + (result.skipped > 0 ? result.skipped + ' 项因重复被跳过' : '无可用数据') + '）');
    }
  }

  // 获取当前排期的分组数据（供下单模块引用日期使用）
  function getGroupedProjects() {
    return (data.groupedProjects || []).map(g => ({
      orderText: g.orderText,
      installDate: g.installDate,
      installDateISO: g.installDateISO,
      daysText: g.daysText,
      items: g.items.map(i => ({ name: i.name, remark: i.remark || '', content: i.content || '' }))
    }));
  }

  function getCurrentPlanType() {
    return data.currentPlanType;
  }

  // 获取全部排期数据用于备份（含项目列表、设置等）
  function getPlanBackupData() {
    return {
      version: 1,
      type: 'plan',
      data: {
        projectName: data.projectName,
        startDate: data.startDate,
        installStartDate: data.installStartDate,
        constructionStartDate: data.constructionStartDate,
        currentPlanType: data.currentPlanType,
        skipHoliday: data.skipHoliday,
        installSkipHoliday: data.installSkipHoliday,
        constructionSkipHoliday: data.constructionSkipHoliday,
        projects: JSON.parse(JSON.stringify(data.projects || []))
      }
    };
  }

  // 从备份数据恢复排期模块
  function restorePlanBackup(planData) {
    if (!planData) return;
    const d = planData.data || planData;
    if (d.projectName !== undefined) data.projectName = d.projectName;
    if (d.startDate !== undefined) data.startDate = d.startDate;
    if (d.installStartDate !== undefined) data.installStartDate = d.installStartDate;
    if (d.constructionStartDate !== undefined) data.constructionStartDate = d.constructionStartDate;
    if (d.currentPlanType !== undefined) data.currentPlanType = d.currentPlanType;
    if (d.skipHoliday !== undefined) data.skipHoliday = d.skipHoliday;
    if (d.installSkipHoliday !== undefined) data.installSkipHoliday = d.installSkipHoliday;
    if (d.constructionSkipHoliday !== undefined) data.constructionSkipHoliday = d.constructionSkipHoliday;
    if (d.projects && Array.isArray(d.projects)) data.projects = JSON.parse(JSON.stringify(d.projects));
    saveToLocalStorage();
    calculateDates();
    render();
  }

  function onStartDateChange(e) {
    const v = e.detail && e.detail.value; if (!v) return;
    data.startDate = v;
    if (data.currentPlanType === 'construction') data.constructionStartDate = v;
    else data.installStartDate = v;
    saveToLocalStorage(); calculateDates(); render();
    if (data.currentPlanType === 'construction') {
      alert('排期已完成！\n施工中突发因素较多\n请您注意及时修改时间\n留意下单项目\n祝您一切顺利！');
    } else {
      alert('排期已完成！\n请您根据日期安排进场\n祝您安装顺利！');
    }
  }

  function onSkipHolidayChange(e) {
    const v = !!(e.detail && e.detail.value);
    data.skipHoliday = v;
    if (data.currentPlanType === 'construction') data.constructionSkipHoliday = v;
    else data.installSkipHoliday = v;
    saveToLocalStorage(); calculateDates(); render();
  }

  function onProjectNameChange(e) {
    const v = (e.detail && e.detail.value) || '';
    data.projectName = v; data.editingProjectName = false;
    saveToLocalStorage(); render();
  }

  function startEditProjectName() { data.editingProjectName = true; render(); setTimeout(() => { const el = document.getElementById('projectNameInput'); if (el) { el.focus(); el.select(); } }, 50); }
  function toggleEditMode() { data.editMode = !data.editMode; data.sortMode = false; saveToLocalStorage(); render(); }
  function toggleDaysEditMode() { data.daysEditMode = !data.daysEditMode; render(); }
  function toggleSortMode() { data.sortMode = !data.sortMode; data.dragIndex = -1; data.dragOverIndex = -1; render(); }

  function toggleAddForm() {
    data.showAddForm = !data.showAddForm;
    if (data.showAddForm) {
      data.newProjectName = '';
      data.newProjectDays = '1';
      data.newProjectRemark = '';
      data.newProjectIsNoise = false;
      data.newProjectContent = '';
    }
    render();
  }

  function setNewProjectField(e) {
    const field = e.currentTarget.dataset.field;
    const val = e.detail && e.detail.value !== undefined ? e.detail.value : e.target.value;
    if (field === 'newProjectIsNoise') {
      data[field] = !!(e.target && e.target.checked !== undefined ? e.target.checked : val);
    } else {
      data[field] = val;
    }
    render();
  }

  function addNewProject() {
    const name = String(data.newProjectName || '').trim();
    const daysStr = String(data.newProjectDays || '0').trim();
    const remark = String(data.newProjectRemark || '').trim();
    const content = String(data.newProjectContent || '').trim();
    const isNoise = !!data.newProjectIsNoise;

    if (!name) { alert('请输入项目名称'); render(); return; }
    let days = parseFloat(daysStr);
    if (isNaN(days) || days < 0) days = 0;

    let maxOrder = 0;
    data.projects.forEach(p => { if (p.order > maxOrder) maxOrder = p.order; });
    const newOrder = maxOrder + 1;

    let maxGroupId = 0;
    data.projects.forEach(p => { if (p.groupId > maxGroupId) maxGroupId = p.groupId; });
    const newGroupId = maxGroupId + 1;

    const newItem = {
      order: newOrder,
      name: name,
      days: days,
      remark: remark,
      groupId: newGroupId,
      visible: true
    };
    if (isNoise) newItem.isNoise = true;
    if (data.currentPlanType === 'construction' && content) newItem.content = content;

    data.projects.push(newItem);

    data.showAddForm = false;
    data.newProjectName = '';
    data.newProjectDays = '1';
    data.newProjectRemark = '';
    data.newProjectIsNoise = false;
    data.newProjectContent = '';

    saveToLocalStorage();
    calculateDates();
    render();
    alert('添加成功\n新项目：' + name + '（' + (days === 0 ? '当天' : (days === 0.5 ? '半天' : days + '天')) + '）');
  }

  function selectAll() { data.projects.forEach(p => p.visible = true); saveToLocalStorage(); calculateDates(); render(); }
  function invertSelection() { data.projects.forEach(p => p.visible = !p.visible); saveToLocalStorage(); calculateDates(); render(); }

  function toggleProjectVisible(e) {
    const order = parseInt(e.currentTarget.dataset.order, 10);
    const p = data.projects.find(x => x.order === order);
    if (p) { p.visible = !p.visible; saveToLocalStorage(); calculateDates(); render(); }
  }

  function moveItemUp(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    if (idx <= 0) return;
    const arr = data.projects.slice();
    const tmp = arr[idx-1]; arr[idx-1] = arr[idx]; arr[idx] = tmp;
    data.projects = arr; saveToLocalStorage(); render();
  }

  function moveItemDown(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    if (idx >= data.totalCount - 1) return;
    const arr = data.projects.slice();
    const tmp = arr[idx+1]; arr[idx+1] = arr[idx]; arr[idx] = tmp;
    data.projects = arr; saveToLocalStorage(); render();
  }

  function onDaysCellTap(e) {
    let orders; try { orders = JSON.parse(e.currentTarget.dataset.orders); } catch(e) { orders = []; }
    if (!orders || orders.length === 0) return;
    const projs = data.projects.filter(p => orders.indexOf(p.order) >= 0);
    let total = 0; projs.forEach(p => total += p.days);
    data.currentEditOrders = orders;
    data.currentEditName = projs.map(p => p.name).join('、');
    data.inputDaysValue = String(total);
    data.showDaysModal = true;
    render();
    setTimeout(() => { const el = document.getElementById('inputDaysValue'); if (el) { el.focus(); el.select(); } }, 50);
  }

  function closeDaysModal() { data.showDaysModal = false; render(); }

  function confirmDaysChange() {
    const el = document.getElementById('inputDaysValue');
    let val = data.inputDaysValue;
    if (el) val = el.value;
    val = parseFloat(val); if (isNaN(val) || val < 0) { alert('请输入有效天数'); return; }
    const orders = data.currentEditOrders || [];
    const projs = data.projects.filter(p => orders.indexOf(p.order) >= 0);
    if (projs.length === 0) return;
    if (projs.length === 1) { projs[0].days = val; }
    else {
      const oldTotal = projs.reduce((s,p)=>s+p.days,0);
      if (oldTotal <= 0) { projs[0].days = val; for (let i=1;i<projs.length;i++) projs[i].days = 0; }
      else {
        const ratio = val / oldTotal;
        let assigned = 0;
        projs.forEach((p,i) => {
          if (i < projs.length - 1) { const v = Math.round(p.days*ratio*100)/100; p.days = v; assigned += v; }
          else p.days = Math.round((val - assigned)*100)/100;
        });
      }
    }
    data.showDaysModal = false;
    saveToLocalStorage(); calculateDates(); render();
    alert('修改成功\n已更新：' + data.currentEditName);
  }

  // ===== 导出功能（保持原逻辑） =====
  function showExportModal() { data.showExportModal = true; render(); }
  function closeExportModal() { data.showExportModal = false; render(); }

  function setReminderDays(e) {
    const d = parseInt(e.currentTarget.dataset.days, 10);
    data.reminderDays = d; saveToLocalStorage(); render();
  }

  function setExportAll(e) {
    const v = e.currentTarget.dataset.value === 'true';
    data.exportAll = v; saveToLocalStorage(); render();
  }

  function _icsDate(d) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth()+1).padStart(2,'0');
    const dd = String(d.getUTCDate()).padStart(2,'0');
    const hh = String(d.getUTCHours()).padStart(2,'0');
    const mi = String(d.getUTCMinutes()).padStart(2,'0');
    const ss = String(d.getUTCSeconds()).padStart(2,'0');
    return yyyy + mm + dd + 'T' + hh + mi + ss + 'Z';
  }

  function confirmExport() {
    const du = window.dateUtils;
    const groups = data.groupedProjects || [];
    if (groups.length === 0) { alert('暂无可导出的排期项目'); return; }
    let filtered = groups;
    if (!data.exportAll) {
      filtered = groups.filter(g => {
        for (const p of g.items) if (p.remark && String(p.remark).trim()) return true;
        return false;
      });
      if (filtered.length === 0) { alert('没有找到带有待办备注的项目\n请勾选"全部项目"再导出'); return; }
    }
    data.showExportProgress = true;
    data.showExportModal = false;
    data.exportTotal = filtered.length;
    data.exportCurrent = 0;
    data.exportPercent = 0;
    data.exportCurrentName = '准备中';
    render();
    setTimeout(() => {
      try {
        const title = (data.calendarTitle || '装修安装计划').replace(/[\n\r;,\\]/g, ' ');
        const pn = (data.projectName || '装修项目').replace(/[\n\r;,\\]/g, ' ');
        const rtSplit = (data.reminderTime || '09:00').split(':');
        const rh = parseInt(rtSplit[0],10)||9, rm = parseInt(rtSplit[1],10)||0;
        const remDays = data.reminderDays || 0;
        const now = new Date();
        let ics = '';
        ics += 'BEGIN:VCALENDAR\r\n';
        ics += 'VERSION:2.0\r\n';
        ics += 'PRODID:-//Project Plan Desktop//CN//ZH\r\n';
        ics += 'CALSCALE:GREGORIAN\r\n';
        ics += 'METHOD:PUBLISH\r\n';
        ics += 'X-WR-CALNAME:' + title + '\r\n';
        filtered.forEach((g, idx) => {
          data.exportCurrent = idx + 1;
          data.exportPercent = Math.round(((idx+1) / filtered.length) * 100);
          data.exportCurrentName = g.items[0].name;
          const itemNames = g.items.map(p => p.name).join('、');
          const remarks = g.items.map(p => p.remark || '').join('；');
          const contents = g.items.map(p => p.content || '').join('；');
          const dStr = g.installDate || '';
          const startDt = du.parseDate(dStr.indexOf('至')>0 ? dStr.split('至')[0].trim() : dStr.trim());
          const endD = du.parseDate(g.endDate || startDt);
          const dtStart = new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate(), rh, rm, 0);
          const dtEnd = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate(), rh, rm, 0);
          dtEnd.setDate(dtEnd.getDate() + 1);
          const uid = 'ppg' + g.groupId + '-' + idx + '-' + Date.now() + '@local';
          ics += 'BEGIN:VEVENT\r\n';
          ics += 'UID:' + uid + '\r\n';
          ics += 'DTSTAMP:' + _icsDate(now) + '\r\n';
          ics += 'DTSTART;VALUE=DATE:' + String(dtStart.getFullYear()) + String(dtStart.getMonth()+1).padStart(2,'0') + String(dtStart.getDate()).padStart(2,'0') + '\r\n';
          ics += 'DTEND;VALUE=DATE:' + String(dtEnd.getFullYear()) + String(dtEnd.getMonth()+1).padStart(2,'0') + String(dtEnd.getDate()).padStart(2,'0') + '\r\n';
          ics += 'SUMMARY:[' + pn + '] ' + itemNames + '\r\n';
          ics += 'DESCRIPTION:项目：' + pn + '\\n工序：' + itemNames + '\\n工作内容：' + contents + '\\n备注：' + remarks + '\r\n';
          ics += 'X-MICROSOFT-CDO-BUSYSTATUS:BUSY\r\n';
          ics += 'BEGIN:VALARM\r\n';
          ics += 'ACTION:DISPLAY\r\n';
          ics += 'DESCRIPTION:提醒：' + itemNames + '\r\n';
          ics += 'TRIGGER:-P' + remDays + 'DT' + String(rh).padStart(2,'0') + 'H' + String(rm).padStart(2,'0') + 'M00S\r\n';
          ics += 'END:VALARM\r\n';
          ics += 'END:VEVENT\r\n';
        });
        ics += 'END:VCALENDAR\r\n';
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (data.projectName || '项目计划表') + '.ics';
        document.body.appendChild(a); a.click();
        setTimeout(() => { try { URL.revokeObjectURL(url); document.body.removeChild(a); } catch(e) {} }, 2000);
        data.showExportProgress = false;
        render();
        setTimeout(() => {
          const tip = data.currentPlanType === 'construction'
            ? '已生成工地施工日历文件\n\n共 '+filtered.length+' 个阶段\n请双击下载的 .ics 文件导入 Outlook/Google 日历'
            : '已生成安装进度日历文件\n\n共 '+filtered.length+' 个阶段\n请双击下载的 .ics 文件导入 Outlook/Google 日历';
          alert(tip);
        }, 300);
      } catch(e) {
        data.showExportProgress = false;
        render();
        alert('导出失败：' + (e.message || String(e)));
      }
    }, 120);
  }

  function exportExcel() {
    const groups = data.groupedProjects || [];
    if (groups.length === 0) { alert('暂无可导出的表格数据'); return; }
    if (typeof XLSX === 'undefined') { alert('Excel 库未加载，请检查 xlsx.js 是否引入'); return; }

    let title, header, rows = [];
    if (data.currentPlanType === 'install') {
      title = (data.projectName ? data.projectName + ' - ' : '') + '安装进度计划表';
      header = ['安装顺序','产品','安装日期','施工周期/天','备注'];
      groups.forEach(g => {
        const names = g.items.map(p => p.name).join('\n');
        const rems = g.items.map(p => p.remark || '').join('\n');
        rows.push([g.orderText, names, g.installDate, g.daysText, rems]);
      });
    } else {
      title = (data.projectName ? data.projectName + ' - ' : '') + '工地施工计划表';
      header = ['序号','施工工序','工作内容','计划日期','计划工期','需下单内容'];
      groups.forEach(g => {
        const names = g.items.map(p => p.name).join('\n');
        const conts = g.items.map(p => p.content || '').join('\n');
        const rems = g.items.map(p => p.remark || '').join('\n');
        rows.push([g.orderText, names, conts, g.installDate, g.daysText, rems]);
      });
    }

    const wsData = [[title], [], header];
    rows.forEach(r => wsData.push(r));

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];
    ws['!cols'] = header.map((h, i) => {
      let w = h.length * 2 + 4;
      rows.forEach(r => {
        if (r[i]) {
          const lines = String(r[i]).split('\n');
          lines.forEach(line => { if (line.length > w) w = line.length; });
        }
      });
      return { wch: Math.min(Math.max(w + 2, 10), 50) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '计划表');

    const fileName = (data.projectName || '项目计划表') + '.xlsx';
    XLSX.writeFile(wb, fileName);

    data.showExportTableModal = false;
    render();
    setTimeout(() => { alert('Excel 文件已生成\n\n文件名：' + fileName + '\n请在下载目录查看'); }, 200);
  }

  function showExportTableModal() { data.showExportTableModal = true; render(); }
  function closeExportTableModal() { data.showExportTableModal = false; render(); }

  function _copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('复制成功\n现在可直接粘贴到 Excel / WPS 表格');
      }).catch(() => { _copyTextFallback(text); });
    } else _copyTextFallback(text);
  }

  function _copyTextFallback(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) alert('复制成功\n现在可直接粘贴到 Excel / WPS 表格');
      else alert('复制失败，请手动选择内容复制');
    } catch(e) { alert('复制失败：' + (e.message || String(e))); }
  }

  function copyTableText() {
    const groups = data.groupedProjects || [];
    if (groups.length === 0) { alert('暂无可复制的表格数据'); return; }
    let title; const rows = [];
    if (data.currentPlanType === 'install') {
      title = (data.projectName ? data.projectName + ' - ' : '') + '安装进度计划表';
      rows.push(['安装顺序','产品','安装日期','施工周期/天','备注']);
      groups.forEach(g => {
        const names = g.items.map(p => p.name).join('\n');
        const rems = g.items.map(p => p.remark || '').join('\n');
        rows.push([g.orderText, names, g.installDate, g.daysText, rems]);
      });
    } else {
      title = (data.projectName ? data.projectName + ' - ' : '') + '工地施工计划表';
      rows.push(['序号','施工工序','工作内容','计划日期','计划工期','需下单内容']);
      groups.forEach(g => {
        const names = g.items.map(p => p.name).join('\n');
        const conts = g.items.map(p => p.content || '').join('\n');
        const rems = g.items.map(p => p.remark || '').join('\n');
        rows.push([g.orderText, names, conts, g.installDate, g.daysText, rems]);
      });
    }
    const txt = title + '\n\n' + rows.map(r => r.map(cell => String(cell||'').replace(/\t/g,' ')).join('\t')).join('\n');
    _copyText(txt);
  }

  function saveTableImage() {
    const groups = data.groupedProjects || [];
    if (groups.length === 0) { alert('暂无可保存的表格数据'); return; }
    const canvas = document.getElementById('exportCanvas');
    if (!canvas) { alert('Canvas 未初始化'); return; }
    let cols, header, titleText;
    if (data.currentPlanType === 'install') {
      cols = [80, 250, 170, 100, 260];
      header = ['安装顺序','产品','安装日期','施工周期/天','备注'];
      titleText = (data.projectName ? data.projectName + ' - ' : '') + '安装进度计划表';
    } else {
      cols = [60, 150, 180, 150, 90, 250];
      header = ['序号','施工工序','工作内容','计划日期','计划工期','需下单内容'];
      titleText = (data.projectName ? data.projectName + ' - ' : '') + '工地施工计划表';
    }
    const padX = 30, padY = 30;
    const rowH = 42;
    const headH = 54;
    const titleH = 64;
    const width = cols.reduce(function(a,b){return a+b;},0) + padX * 2;
    const height = padY * 2 + titleH + headH + (groups.length + 2) * rowH;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 22px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(titleText, width / 2, padY + titleH / 2 - 6);
    if (data.currentPlanType === 'construction') {
      ctx.font = '14px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#d32f2f';
      ctx.fillText('（原始天数以100㎡计算）', width / 2, padY + titleH - 8);
    }
    let x = padX; let y = padY + titleH;
    ctx.font = 'bold 14px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1976D2';
    ctx.fillRect(x, y, cols.reduce(function(a,b){return a+b;},0), headH);
    ctx.fillStyle = '#fff';
    let hx = x;
    for (let i = 0; i < header.length; i++) {
      ctx.fillText(header[i], hx + cols[i] / 2, y + headH / 2);
      hx += cols[i];
    }
    ctx.font = '13px "PingFang SC","Microsoft YaHei",sans-serif';
    y += headH;
    groups.forEach(function(g, gi) {
      const fillBg = gi % 2 === 0 ? '#f7faff' : '#ffffff';
      ctx.fillStyle = fillBg;
      ctx.fillRect(x, y, cols.reduce(function(a,b){return a+b;},0), rowH);
      ctx.fillStyle = '#333';
      let cx = x;
      const values = [];
      if (data.currentPlanType === 'install') {
        const names = g.items.map(function(p){return p.name;}).join('、');
        const rems = g.items.map(function(p){return p.remark || '';}).join('；');
        values.push(String(g.orderText), names, g.installDate, g.daysText, rems);
      } else {
        const names = g.items.map(function(p){return p.name;}).join('、');
        const conts = g.items.map(function(p){return p.content || '';}).join('；');
        const rems = g.items.map(function(p){return p.remark || '';}).join('；');
        values.push(String(g.orderText), names, conts, g.installDate, g.daysText, rems);
      }
      for (let i = 0; i < values.length; i++) {
        const text = values[i];
        const maxW = cols[i] - 8;
        ctx.textAlign = (i === 1 || i === 2 || i === 5) ? 'left' : 'center';
        ctx.fillStyle = '#333';
        let drawText = text;
        if (ctx.measureText(drawText).width > maxW) {
          while (drawText.length > 0 && ctx.measureText(drawText + '…').width > maxW) drawText = drawText.slice(0, -1);
          drawText = drawText + '…';
        }
        const dx = (i === 1 || i === 2 || i === 5) ? cx + 6 : cx + cols[i] / 2;
        ctx.fillText(drawText, dx, y + rowH / 2);
        cx += cols[i];
      }
      y += rowH;
    });
    ctx.fillStyle = '#1976D2';
    ctx.fillRect(x, y, cols.reduce(function(a,b){return a+b;},0), rowH + 8);
    y += 8;
    ctx.fillStyle = '#fff';
    ctx.font = '14px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    const totalText = '总项目：' + data.visibleCount + ' 项';
    const startText = '开始：' + (groups[0] ? groups[0].installDate : '');
    const endText = '预计完成：' + (groups[groups.length-1] ? groups[groups.length-1].endDate : '');
    ctx.fillText(totalText, x + 16, y + rowH / 2 - 8);
    ctx.fillText(startText, x + 140, y + rowH / 2 - 8);
    ctx.fillText(endText, x + 310, y + rowH / 2 - 8);
    ctx.strokeStyle = '#d0d7e2'; ctx.lineWidth = 1;
    let yy = padY + titleH;
    for (let r = 0; r <= groups.length + 1; r++) {
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + cols.reduce(function(a,b){return a+b;},0), yy); ctx.stroke();
      yy += (r === 0 ? headH : rowH);
    }
    let xx = padX;
    for (let c = 0; c <= cols.length; c++) {
      ctx.beginPath(); ctx.moveTo(xx, padY + titleH); ctx.lineTo(xx, padY + titleH + headH + groups.length * rowH); ctx.stroke();
      if (c < cols.length) xx += cols[c];
    }
    try {
      canvas.toBlob(function(blob) {
        if (!blob) { alert('图片生成失败'); return; }
        try {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = (data.projectName || '项目计划表') + '.png';
          document.body.appendChild(a); a.click();
          setTimeout(function() { try { URL.revokeObjectURL(url); document.body.removeChild(a); } catch(e) {} }, 2000);
          data.showExportTableModal = false;
          render();
          setTimeout(function() { alert('图片已保存为 PNG 格式\n请在浏览器下载目录查看'); }, 250);
        } catch(e) { alert('保存失败：' + (e.message || String(e))); }
      }, 'image/png');
    } catch(e) { alert('保存失败：' + (e.message || String(e))); }
  }

  function init() {
    onLoad();
    bindEvents();
  }

  // 暴露到全局
  window.planModule = {
    init,
    render,
    setData,
    switchPlanType,
    generateOrderList,
    getGroupedProjects,
    getCurrentPlanType,
    getPlanBackupData,
    restorePlanBackup,
    onStartDateChange,
    onSkipHolidayChange,
    onProjectNameChange,
    startEditProjectName,
    toggleEditMode,
    toggleDaysEditMode,
    toggleSortMode,
    toggleAddForm,
    setNewProjectField,
    addNewProject,
    selectAll,
    invertSelection,
    toggleProjectVisible,
    moveItemUp,
    moveItemDown,
    onDaysCellTap,
    closeDaysModal,
    confirmDaysChange,
    showExportModal,
    closeExportModal,
    setReminderDays,
    setExportAll,
    confirmExport,
    exportExcel,
    showExportTableModal,
    closeExportTableModal,
    copyTableText,
    saveTableImage
  };
})();
