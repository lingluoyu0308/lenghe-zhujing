// dateUtils.js - 日期工具函数模块
// 作用：封装项目中所有与日期相关的计算逻辑，便于复用和维护
// 排期逻辑保持与原项目安装计划表完全一致

/**
 * 格式化日期为完整格式：YYYY年MM月DD日
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * 格式化日期为简短格式：MM月DD日（省略年份）
 */
function formatDateShort(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

/**
 * 在指定日期上增加天数
 */
function addDays(date, days) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/**
 * 获取星期几的中文表示
 */
function getWeekDay(date) {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekDays[date.getDay()];
}

/**
 * 将 "YYYY年MM月DD日" 格式的字符串解析为 Date 对象
 */
function parseDate(dateStr) {
  const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return null;
}

// 节假日数据（保持与原系统一致）
const HOLIDAYS = {
  '2026-01-01': { name: '元旦', type: 'legal' },
  '2026-02-17': { name: '春节', type: 'legal' },
  '2026-02-18': { name: '春节', type: 'legal' },
  '2026-02-19': { name: '春节', type: 'legal' },
  '2026-02-20': { name: '春节', type: 'legal' },
  '2026-02-21': { name: '春节', type: 'legal' },
  '2026-02-22': { name: '春节', type: 'legal' },
  '2026-02-23': { name: '春节', type: 'legal' },
  '2026-04-04': { name: '清明节', type: 'legal' },
  '2026-04-05': { name: '清明节', type: 'legal' },
  '2026-04-06': { name: '清明节', type: 'legal' },
  '2026-05-01': { name: '劳动节', type: 'legal' },
  '2026-05-02': { name: '劳动节', type: 'legal' },
  '2026-05-03': { name: '劳动节', type: 'legal' },
  '2026-05-04': { name: '劳动节', type: 'legal' },
  '2026-05-05': { name: '劳动节', type: 'legal' },
  '2026-06-19': { name: '端午节', type: 'legal' },
  '2026-06-20': { name: '端午节', type: 'legal' },
  '2026-06-21': { name: '端午节', type: 'legal' },
  '2026-09-25': { name: '中秋节', type: 'legal' },
  '2026-09-26': { name: '中秋节', type: 'legal' },
  '2026-09-27': { name: '中秋节', type: 'legal' },
  '2026-10-01': { name: '国庆节', type: 'legal' },
  '2026-10-02': { name: '国庆节', type: 'legal' },
  '2026-10-03': { name: '国庆节', type: 'legal' },
  '2026-10-04': { name: '国庆节', type: 'legal' },
  '2026-10-05': { name: '国庆节', type: 'legal' },
  '2026-10-06': { name: '国庆节', type: 'legal' },
  '2026-10-07': { name: '国庆节', type: 'legal' }
};

/**
 * 检查指定日期是否为周末
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 检查指定日期是否为法定节假日
 */
function isLegalHoliday(date) {
  const key = formatDateKey(date);
  return HOLIDAYS[key] && HOLIDAYS[key].type === 'legal';
}

/**
 * 检查指定日期是否为不可施工日（周末或法定节假日）
 */
function isNonWorkday(date) {
  return isWeekend(date) || isLegalHoliday(date);
}

/**
 * 将日期格式化为 YYYY-MM-DD 格式的键
 */
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 推进到下一个工作日（跳过周末和法定节假日）
 */
function skipToWorkday(date) {
  const newDate = new Date(date);
  while (isNonWorkday(newDate)) {
    newDate.setDate(newDate.getDate() + 1);
  }
  return newDate;
}

/**
 * 在指定日期上增加工作日（自动跳过周末和节假日）
 */
function addWorkDays(date, days) {
  if (days === 0) return skipToWorkday(date);
  const newDate = new Date(date);
  let added = 0;
  while (added < days) {
    newDate.setDate(newDate.getDate() + 1);
    if (!isNonWorkday(newDate)) {
      added++;
    }
  }
  return skipToWorkday(newDate);
}

window.dateUtils = { formatDate, formatDateShort, addDays, getWeekDay, parseDate, isWeekend, isLegalHoliday, isNonWorkday, skipToWorkday, addWorkDays, HOLIDAYS };
